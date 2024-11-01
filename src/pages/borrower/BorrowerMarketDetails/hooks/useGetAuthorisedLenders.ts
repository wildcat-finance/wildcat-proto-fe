import { useQuery } from "@tanstack/react-query"
import {
  GetAuthorizedLendersByMarketDocument,
  SubgraphGetAuthorizedLendersByMarketQuery,
  SubgraphGetAuthorizedLendersByMarketQueryVariables,
} from "@wildcatfi/wildcat-sdk/dist/gql/graphql"
import { logger } from "@wildcatfi/wildcat-sdk/dist/utils/logger"
import { Market } from "@wildcatfi/wildcat-sdk"
import { SubgraphClient } from "../../../../config/subgraph"

export const GET_LENDERS_BY_MARKET_KEY = "get-authorised-lenders-by-market"
export const useGetAuthorisedLendersByMarket = (market: Market | undefined) => {
  const getAuthorisedLendersByMarket = async () => {
    if (!market) throw Error()

    logger.debug(`Getting authorised lenders batches...`)

    const res = await SubgraphClient.query<
      SubgraphGetAuthorizedLendersByMarketQuery,
      SubgraphGetAuthorizedLendersByMarketQueryVariables
    >({
      query: GetAuthorizedLendersByMarketDocument,
      variables: { market: market.address.toLowerCase() },
    })

    logger.debug(
      `Got authorised lenders : ${res.data.market?.controller!
        .authorizedLenders}`,
    )

    return res.data?.market?.controller!.authorizedLenders.map(
      (lender) => lender.lender,
    )
  }

  return useQuery({
    queryKey: [GET_LENDERS_BY_MARKET_KEY, market?.address],
    queryFn: getAuthorisedLendersByMarket,
    enabled: !!market,
    refetchOnMount: false,
  })
}
