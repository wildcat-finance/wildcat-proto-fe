import { useQuery } from "@tanstack/react-query"
import {
  GetMarketsForBorrowerDocument,
  SubgraphGetMarketsForBorrowerQuery,
  SubgraphGetMarketsForBorrowerQueryVariables,
  SubgraphGetMarketsForAllBorrowersQuery,
  SubgraphGetMarketsForAllBorrowersQueryVariables,
  GetMarketsForAllBorrowersDocument,
} from "@wildcatfi/wildcat-sdk/dist/gql/graphql"
import {
  Market,
  getLensContract,
  SignerOrProvider,
  MarketVersion,
} from "@wildcatfi/wildcat-sdk"
import { logger } from "@wildcatfi/wildcat-sdk/dist/utils/logger"
import { POLLING_INTERVAL } from "../../../config/polling"
import { TargetChainId } from "../../../config/networks"
import { SubgraphClient } from "../../../config/subgraph"
import { useEthersProvider } from "../../../modules/hooks/useEthersSigner"
import { chunk } from "../../../utils/chunk"

export const GET_BORROWER_MARKETS_LIST_KEY = "get-borrower-markets-list"

export type MarketsForBorrowerProps = {
  borrower: string | undefined
  provider: SignerOrProvider | undefined
  enabled: boolean
} & Omit<SubgraphGetMarketsForBorrowerQueryVariables, "borrower">

export function useMarketsForBorrowerQuery({
  borrower: _borrower,
  provider,
  enabled,
  ...filters
}: MarketsForBorrowerProps) {
  const borrower = _borrower?.toLowerCase()
  const CHUNK_SIZE = TargetChainId === 1 ? 3 : 50

  async function queryMarketsForAllBorrowers() {
    const result = await SubgraphClient.query<
      SubgraphGetMarketsForAllBorrowersQuery,
      SubgraphGetMarketsForAllBorrowersQueryVariables
    >({
      query: GetMarketsForAllBorrowersDocument,
      variables: { ...filters },
      fetchPolicy: "network-only",
    })

    return (
      result.data.markets
        .filter((m) => !!m.controller)
        .map((market) =>
          Market.fromSubgraphMarketData(
            TargetChainId,
            provider as SignerOrProvider,
            market,
          ),
        ) ?? []
    )
  }

  async function queryMarketsForBorrower() {
    const result = await SubgraphClient.query<
      SubgraphGetMarketsForBorrowerQuery,
      SubgraphGetMarketsForBorrowerQueryVariables
    >({
      query: GetMarketsForBorrowerDocument,
      variables: {
        borrower: borrower as string,
        ...filters,
        marketFilter: {
          version: MarketVersion.V1,
        },
      },
      fetchPolicy: "network-only",
    })

    return result.data.markets
      .filter((m) => !!m.controller)
      .map((market) =>
        Market.fromSubgraphMarketData(
          TargetChainId,
          provider as SignerOrProvider,
          market,
        ),
      )
  }

  async function updateMarkets(markets: Market[]) {
    const lens = getLensContract(TargetChainId, provider as SignerOrProvider)
    let chunks: Market[][]
    if (TargetChainId === 1) {
      chunks = [
        ...markets
          .filter(
            (m) =>
              m.underlyingToken.address.toLowerCase() ===
              "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
          )
          .map((m) => [m]),
        markets.filter(
          (m) =>
            m.underlyingToken.address.toLowerCase() !==
            "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        ),
      ]
    } else {
      chunks = [markets]
    }
    await Promise.all(
      chunks.map(async (marketsChunk) => {
        const updates = await lens.getMarketsData(
          marketsChunk.map((m) => m.address),
        )
        marketsChunk.forEach((market, i) => {
          market.updateWith(updates[i])
        })
      }),
    )
    logger.debug(`Got ${markets.length} market updates`)
    return markets
  }

  async function getMarketsForBorrower() {
    const subgraphMarkets = await (borrower
      ? queryMarketsForBorrower
      : queryMarketsForAllBorrowers)()
    return updateMarkets(subgraphMarkets)
  }

  return useQuery({
    queryKey: [GET_BORROWER_MARKETS_LIST_KEY, borrower],
    queryFn: getMarketsForBorrower,
    refetchInterval: POLLING_INTERVAL,
    enabled,
    refetchOnMount: false,
  })
}

export const useMarketsForBorrower = (borrower?: string) => {
  const { isWrongNetwork, provider, signer } = useEthersProvider()

  const signerOrProvider = signer ?? provider
  console.log(
    `logging from useMarketsForBorrower.ts: ${borrower} | have provider: ${!!provider} | isWrongNetwork: ${isWrongNetwork}`,
  )

  return useMarketsForBorrowerQuery({
    borrower,
    provider: signerOrProvider,
    enabled: !!signerOrProvider && !isWrongNetwork,
  })
}
