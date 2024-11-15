import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  LenderWithdrawalStatus,
  Market,
  MarketAccount,
  Token,
  TokenAmount,
} from "@wildcatfi/wildcat-sdk"
import { parseUnits } from "ethers/lib/utils"

import { WildcatMarketController } from "@wildcatfi/wildcat-sdk/dist/typechain"
import { BaseTransaction } from "@safe-global/safe-apps-sdk"
import { useAccount } from "wagmi"
import { BigNumber, ContractTransaction } from "ethers"
import { useEthersSigner } from "../../../../modules/hooks"
import {
  toastifyError,
  toastifyInfo,
  toastifyRequest,
} from "../../../../components/toasts"
import { GET_MARKET_KEY } from "../../../../hooks/useGetMarket"
import { useGetControllerContract } from "../../../../hooks/useGetController"
import { GET_WITHDRAWALS_KEY } from "../BorrowerWithdrawalRequests/hooks/useGetWithdrawals"
import { TOKEN_FORMAT_DECIMALS } from "../../../../utils/formatters"
import {
  GET_BORROWER_MARKET_ACCOUNT_LEGACY_KEY,
  GET_MARKET_ACCOUNT_KEY,
} from "../../../../hooks/useGetMarketAccount"
import { useGetMarketsForController } from "./useGetMarketsForController"
import { GET_LENDERS_BY_MARKET_KEY } from "./useGetAuthorisedLenders"
import { useGnosisSafeSDK } from "../../../../hooks/useGnosisSafeSDK"
import { waitForSubgraphSync } from "../../../../utils/waitForSubgraphSync"
import { GET_LENDER_MARKET_ACCOUNT_KEY } from "../../../lenders/hooks/useLenderMarketAccount"

export const useBorrow = (marketAccount: MarketAccount) => {
  const signer = useEthersSigner()
  const client = useQueryClient()

  return useMutation({
    mutationFn: async (amount: string) => {
      if (!marketAccount || !signer) {
        return
      }

      const tokenAmount = new TokenAmount(
        parseUnits(amount, marketAccount.market.underlyingToken.decimals),
        marketAccount.market.underlyingToken,
      )

      const borrow = async () => {
        const tx = await marketAccount.borrow(tokenAmount)
        return tx.wait()
      }

      const receipt = await toastifyRequest(borrow(), {
        pending: `Borrowing ${tokenAmount.format(
          tokenAmount.token.decimals,
          true,
        )}...`,
        success: `Borrowed ${tokenAmount.format(
          tokenAmount.token.decimals,
          true,
        )}!`,
        error: `Error: Borrow Failed`,
      })
      await waitForSubgraphSync(receipt.blockNumber)
    },
    onSuccess() {
      client.invalidateQueries({
        queryKey: [GET_BORROWER_MARKET_ACCOUNT_LEGACY_KEY],
      })
    },
    onError(error) {
      console.log(error)
    },
  })
}

export const useGetAllowance = (token: Token) => {
  const signer = useEthersSigner()
  const client = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!signer) {
        return
      }

      const getAllowance = async () => {
        const allowance = await token.contract.allowance(
          token.address,
          signer.getAddress(),
        )
        return allowance
      }

      getAllowance()
    },
    onSuccess() {
      client.invalidateQueries({ queryKey: [GET_MARKET_KEY] })
    },
  })
}

const USDT_ADDRESSES = [
  "0xdac17f958d2ee523a2206206994597c13d831ec7",
  "0x4e1acc8699618cf4b487346c5dd7c6dec4e11321",
]

export const useApprove = (
  token: Token,
  market: Market,
  currentAllowance?: BigNumber,
) => {
  const client = useQueryClient()

  return useMutation({
    mutationFn: async (tokenAmount: TokenAmount) => {
      if (!market) {
        return
      }

      const approve = async () => {
        const tx = await token.contract.approve(
          market.address.toLowerCase(),
          tokenAmount.raw,
        )
        return tx.wait()
      }

      // for USDT, approvals must be reset to 0 before they can be updated
      if (
        USDT_ADDRESSES.includes(tokenAmount.token.address.toLowerCase()) &&
        currentAllowance?.gt(0)
      ) {
        const resetAllowance = async () => {
          const tx = await token.contract.approve(
            market.address.toLowerCase(),
            0,
          )
          return tx.wait()
        }
        await toastifyRequest(resetAllowance(), {
          pending: `Step 1/2: Resetting allowance for ${tokenAmount.token.symbol}...`,
          success: `Step 1/2: Successfully reset allowance for ${tokenAmount.token.symbol}!`,
          error: `Error: Reset allowance for ${token.symbol} failed`,
        })
        const receipt = await toastifyRequest(approve(), {
          pending: `Step 2/2: Approving ${tokenAmount.format(
            tokenAmount.token.decimals,
            true,
          )}...`,
          success: `Successfully Approved ${tokenAmount.format(
            tokenAmount.token.decimals,
            true,
          )}!`,
          error: `Error: Approval for ${token.symbol} failed`,
        })
        await waitForSubgraphSync(receipt.blockNumber)
      } else {
        const receipt = await toastifyRequest(approve(), {
          pending: `Approving ${tokenAmount.format(
            tokenAmount.token.decimals,
            true,
          )}...`,
          success: `Successfully Approved ${tokenAmount.format(
            tokenAmount.token.decimals,
            true,
          )}!`,
          error: `Error: ${token.symbol} Approval Failed`,
        })
        await waitForSubgraphSync(receipt.blockNumber)
      }
    },
    onSuccess() {
      client.invalidateQueries({ queryKey: [GET_MARKET_ACCOUNT_KEY] })
      client.invalidateQueries({ queryKey: [GET_LENDER_MARKET_ACCOUNT_KEY] })
      client.invalidateQueries({
        queryKey: [GET_BORROWER_MARKET_ACCOUNT_LEGACY_KEY],
      })
    },
  })
}

export const useProcessUnpaidWithdrawalBatch = (
  marketAccount: MarketAccount,
) => {
  const client = useQueryClient()
  const { isConnectedToSafe, sendTransactions: sendGnosisTransactions } =
    useGnosisSafeSDK()

  return useMutation({
    mutationFn: async ({
      tokenAmount,
      maxBatches,
    }: {
      tokenAmount: TokenAmount
      maxBatches: number
    }) => {
      if (!marketAccount) {
        return
      }

      const processWithdrawalBatch = async () => {
        const { status } = marketAccount.checkRepayStep(tokenAmount)
        if (isConnectedToSafe && status === "InsufficientAllowance") {
          const gnosisTransactions = [
            await marketAccount.populateApproveMarket(tokenAmount),
            await marketAccount.market.populateRepayAndProcessUnpaidWithdrawalBatches(
              tokenAmount,
              maxBatches,
            ),
          ]
          const tx = await sendGnosisTransactions(gnosisTransactions)
          await tx.wait()
        } else {
          const tx =
            await marketAccount.market.repayAndProcessUnpaidWithdrawalBatches(
              tokenAmount,
              maxBatches,
            )
          await tx.wait()
        }
      }

      await toastifyRequest(processWithdrawalBatch(), {
        pending: `Closing unpaid withdrawal batch...`,
        success: `Successfully closed batch!`,
        error: `Error: Closing withdrawal batch for ${marketAccount.market.name} failed`,
      })
    },
    onSuccess() {
      client.invalidateQueries({ queryKey: [GET_MARKET_ACCOUNT_KEY] })
      client.invalidateQueries({
        queryKey: [GET_BORROWER_MARKET_ACCOUNT_LEGACY_KEY],
      })
      client.invalidateQueries({
        queryKey: [GET_WITHDRAWALS_KEY],
      })
    },
  })
}

export const useDeposit = (
  marketAccount: MarketAccount,
  onSuccess?: () => void,
) => {
  const signer = useEthersSigner()
  const client = useQueryClient()
  const { isConnectedToSafe, sendTransactions: sendGnosisTransactions } =
    useGnosisSafeSDK()

  return useMutation({
    mutationFn: async (amount: string) => {
      if (!marketAccount || !signer) throw Error()

      const tokenSymbol = marketAccount.market.underlyingToken.symbol

      const tokenAmount = new TokenAmount(
        parseUnits(amount, marketAccount.market.underlyingToken.decimals),
        marketAccount.market.underlyingToken,
      )

      const checkCanDeposit = marketAccount.checkDepositStep(tokenAmount)

      const deposit = async () => {
        if (
          isConnectedToSafe &&
          checkCanDeposit.status === "InsufficientAllowance"
        ) {
          const gnosisTransactions = [
            await marketAccount.populateApproveMarket(tokenAmount),
            await marketAccount.populateDeposit(tokenAmount),
          ]
          // for USDT, approvals must be reset to 0 before they can be updated
          if (
            USDT_ADDRESSES.includes(tokenAmount.token.address.toLowerCase()) &&
            marketAccount.underlyingApproval.gt(0)
          ) {
            gnosisTransactions.unshift(
              await marketAccount.populateApproveMarket(
                tokenAmount.token.getAmount(0),
              ),
            )
          }
          const tx = await sendGnosisTransactions(gnosisTransactions)
          return tx.wait()
        }
        const tx = await marketAccount.deposit(tokenAmount)
        return tx.wait()
      }

      const receipt = await toastifyRequest(deposit(), {
        pending: `Depositing ${amount} ${tokenSymbol}...`,
        success: `Successfully Deposited ${amount} ${tokenSymbol}!`,
        error: `Error: ${checkCanDeposit.status}`,
      })
      await waitForSubgraphSync(receipt.blockNumber)
    },
    onSuccess() {
      if (onSuccess) onSuccess()
      client.invalidateQueries({ queryKey: [GET_MARKET_KEY] })
      client.invalidateQueries({ queryKey: [GET_MARKET_ACCOUNT_KEY] })
    },
    onError(error) {
      console.log(error)
    },
  })
}

export const useClaim = (
  market: Market,
  withdrawals: LenderWithdrawalStatus[],
) => {
  const client = useQueryClient()
  const { address } = useAccount()
  return useMutation({
    mutationFn: async () => {
      const claimableWithdrawals = withdrawals.filter((w) =>
        w.availableWithdrawalAmount.gt(0),
      )
      if (!market || !claimableWithdrawals.length || !address) throw Error

      const claim = async () => {
        const tx =
          claimableWithdrawals.length === 1
            ? await market.executeWithdrawal(claimableWithdrawals[0])
            : await market.executeWithdrawals(claimableWithdrawals)
        await tx?.wait()
      }

      await toastifyRequest(claim(), {
        pending: "Executing Claim...",
        success: "Claim Successful!",
        error: `Error: Claim Execution Failed`,
      })
    },
    onSuccess() {
      client.invalidateQueries({ queryKey: [GET_MARKET_KEY] })
      client.invalidateQueries({ queryKey: [GET_MARKET_ACCOUNT_KEY] })
    },
    onError(error) {
      console.log(error)
    },
  })
}

// export const useClaimSeveral = (market: Market | undefined) => {
//   const client = useQueryClient()
//   const { address } = useAccount()
//   const { data } = useGetWithdrawals(market!.address)
//   console.log(data?.expiredBatches)

//   return useMutation({
//     mutationFn: async () => {
//       if (!market || !address || !data?.expiredBatches.length) {
//         return
//       }

//       const withdrawals = data?.expiredBatches.map((expiredBatch) => ({
//         expiry: expiredBatch.blockTimestamp,
//         lender: address.toLowerCase(),
//       }))

//       const claim = async () => {
//         const tx = await market.executeWithdrawals(withdrawals)
//         await tx?.wait()
//       }

//       await toastifyRequest(claim(), {
//         pending: "Executing Claim...",
//         success: "Claim Successful!",
//         error: `Error: Claim Execution Failed`,
//       })
//     },
//     onSuccess() {
//       client.invalidateQueries({ queryKey: [GET_MARKET_KEY] })
//     },
//     onError(error) {
//       console.log(error)
//     },
//   })
// }

export const useWithdraw = (marketAccount: MarketAccount) => {
  const { address } = useAccount()
  const client = useQueryClient()

  return useMutation({
    mutationFn: async (amount: string) => {
      if (!marketAccount || !address) {
        return
      }

      const tokenAmount = new TokenAmount(
        parseUnits(amount, marketAccount.market.underlyingToken.decimals),
        marketAccount.market.underlyingToken,
      )

      const withdraw = () => marketAccount.queueWithdrawal(tokenAmount)

      const { symbol } = marketAccount.market.underlyingToken

      const { receipt } = await toastifyRequest(withdraw(), {
        pending: `Adding ${amount} ${symbol} to withdrawal queue`,
        success: `${amount} ${symbol} successfully added to withdrawal queue`,
        error: "Error adding to withdrawal queue",
      })
      await waitForSubgraphSync(receipt.blockNumber)
    },
    onSuccess() {
      client.invalidateQueries({ queryKey: [GET_MARKET_KEY] })
      client.invalidateQueries({ queryKey: [GET_WITHDRAWALS_KEY] })
    },
    onError(error, amount) {
      console.log(error, amount)
    },
  })
}

export const useRepay = (marketAccount: MarketAccount) => {
  const signer = useEthersSigner()
  const client = useQueryClient()
  const { isConnectedToSafe, sendTransactions: sendGnosisTransactions } =
    useGnosisSafeSDK()

  return useMutation({
    mutationFn: async (amount: TokenAmount) => {
      if (!marketAccount || !signer) {
        return
      }

      const step = marketAccount.checkRepayStep(amount)
      const gnosisTransactions: BaseTransaction[] = []
      if (step.status !== "Ready") {
        if (isConnectedToSafe && step.status === "InsufficientAllowance") {
          gnosisTransactions.push(
            await marketAccount.populateApproveMarket(amount),
          )
        } else {
          throw Error(
            `Should not be able to reach useRepay when status not ready and not connected to safe`,
          )
        }
      }

      const repay = async () => {
        if (gnosisTransactions.length) {
          gnosisTransactions.push(await marketAccount.populateRepay(amount.raw))
          console.log(`Sending gnosis transactions...`)
          console.log(gnosisTransactions)
          const tx = await sendGnosisTransactions(gnosisTransactions)
          console.log(
            `Got gnosis transaction:\n\tsafeTxHash: ${tx.safeTxHash}\n\ttxHash: ${tx.txHash}`,
          )
          return tx.wait()
        }
        const tx = await marketAccount.repay(amount.raw)
        return tx.wait()
      }

      const { symbol } = marketAccount.market.underlyingToken

      const tokenAmountFormatted = amount.format(TOKEN_FORMAT_DECIMALS)

      const receipt = await toastifyRequest(repay(), {
        pending: `${tokenAmountFormatted} ${symbol} Repayment In Progress...`,
        success: `Successfully Repaid ${tokenAmountFormatted} ${symbol}!`,
        error: `Error: Repayment Attempt Failed`,
      })
      await waitForSubgraphSync(receipt.blockNumber)
    },
    onSuccess() {
      client.invalidateQueries({
        queryKey: [GET_BORROWER_MARKET_ACCOUNT_LEGACY_KEY],
      })
    },
    onError(error) {
      console.log(error)
    },
  })
}

export const useRepayOutstandingDebt = (marketAccount: MarketAccount) => {
  const signer = useEthersSigner()
  const client = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!marketAccount || !signer) {
        return
      }

      const repayOutstandingDebt = async () => {
        const tx = await marketAccount.repayOutstandingDebt()
        return tx.wait()
      }

      const receipt = await toastifyRequest(repayOutstandingDebt(), {
        pending: "Repaying Outstanding Debt...",
        success: "Outstanding Debt Successfully Repaid!",
        error: `Error Repaying Outstanding Debt`,
      })
      await waitForSubgraphSync(receipt.blockNumber)
    },
    onSuccess() {
      toastifyInfo("Repayment In Progress...")
      client.invalidateQueries({
        queryKey: [GET_BORROWER_MARKET_ACCOUNT_LEGACY_KEY],
      })
    },
    onError(error) {
      console.log(error)
    },
  })
}

export const useAdjustAPR = (marketAccount: MarketAccount) => {
  const signer = useEthersSigner()
  const client = useQueryClient()

  return useMutation({
    mutationFn: async (amount: number) => {
      if (!marketAccount || !signer) {
        return
      }

      const setApr = async () => {
        const tx = await marketAccount.setAnnualInterestBips(amount * 100)
        return tx.wait()
      }

      const receipt = await toastifyRequest(setApr(), {
        pending: `Adjusting Lender APR...`,
        success: `Lender APR Successfully Adjusted`,
        error: "Error adjusting Lender APR",
      })
      await waitForSubgraphSync(receipt.blockNumber)
    },
    onSuccess() {
      client.invalidateQueries({
        queryKey: [GET_BORROWER_MARKET_ACCOUNT_LEGACY_KEY],
      })
    },
    onError(error) {
      console.log(error)
    },
  })
}

export const useSetMaxTotalSupply = (marketAccount: MarketAccount) => {
  const signer = useEthersSigner()
  const client = useQueryClient()

  return useMutation({
    mutationFn: async (newMaxTotalSupply: string) => {
      if (!marketAccount || !signer) {
        return
      }

      const supplyTokenAmount = new TokenAmount(
        parseUnits(
          newMaxTotalSupply,
          marketAccount.market.underlyingToken.decimals,
        ),
        marketAccount.market.underlyingToken,
      )

      const setMaxTotalSupply = async () => {
        const tx = await marketAccount.setMaxTotalSupply(supplyTokenAmount)
        return tx.wait()
      }

      const receipt = await toastifyRequest(setMaxTotalSupply(), {
        pending: `Setting Maximum Capacity...`,
        success: `Maximum Capacity successfully Adjusted`,
        error: "Error setting Maximum Capacity",
      })
      await waitForSubgraphSync(receipt.blockNumber)
    },
    onSuccess() {
      client.invalidateQueries({
        queryKey: [GET_BORROWER_MARKET_ACCOUNT_LEGACY_KEY],
      })
    },
    onError(error) {
      console.log(error)
    },
  })
}

export const useTerminateMarket = (marketAccount: MarketAccount) => {
  const signer = useEthersSigner()
  const client = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!signer) {
        return
      }

      const closeMarket = async () => {
        const tx = await marketAccount.closeMarket()
        return tx.wait()
      }

      const receipt = await toastifyRequest(closeMarket(), {
        pending: `Terminating Market...`,
        success: `Successfully Terminated Market!`,
        error: "Error Terminating Market",
      })
      await waitForSubgraphSync(receipt.blockNumber)
    },
    onSuccess() {
      client.invalidateQueries({
        queryKey: [GET_BORROWER_MARKET_ACCOUNT_LEGACY_KEY],
      })
    },
    onError(error) {
      console.log(error)
    },
  })
}

async function updateLenderAuthorizationForAll(
  controller: WildcatMarketController | undefined,
  lenders: string[],
  market: string,
) {
  if (controller) {
    await toastifyRequest(
      Promise.all(
        lenders.map(async (lender) => {
          const tx = await controller.updateLenderAuthorization(
            lender.toLowerCase(),
            [market],
          )

          await tx.wait()
        }),
      ),
      {
        pending: "Step 2/2: Updating Lender Roles...",
        success: "Step 2/2: Roles Successfully Updated!",
        error: "Error Authorising Lenders",
      },
    )
  }
}

export const useAuthoriseLenders = (
  lenders: string[],
  controllerAddress: string,
) => {
  const { data: controller } = useGetControllerContract(controllerAddress)
  const { data: markets } = useGetMarketsForController(controllerAddress)
  const client = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!lenders.length) {
        toastifyError("Add At Least One Lender Address")
        return
      }
      if (!controller) {
        toastifyError("Controller Not Found")
        return
      }
      const authoriseLenders = async () => {
        const tx = await controller.authorizeLenders(lenders)
        return tx.wait()
      }

      const receipt = await toastifyRequest(authoriseLenders(), {
        pending: "Authorising Lenders...",
        success: "Lenders Successfully Authorised!",
        error: "Error authorising lenders",
      })
      await waitForSubgraphSync(receipt.blockNumber)
    },
    onSuccess() {
      client.invalidateQueries({ queryKey: [GET_LENDERS_BY_MARKET_KEY] })
    },
    onError(error) {
      toastifyError(`Error Authorising Lenders: ${error}`)
    },
  })
}

export const useDeauthorizeLenders = (
  authorizedLenders: string[],
  controllerAddress: string,
) => {
  const { data: controller } = useGetControllerContract(controllerAddress)
  const { data: markets } = useGetMarketsForController(controllerAddress)
  const client = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!authorizedLenders.length) {
        toastifyError("Error: No Addresses Provided")
        return
      }
      if (!controller) {
        toastifyError("Controller Not Found")
        return
      }
      const deauthorizeLenders = async () => {
        let tx: ContractTransaction
        if (markets?.length) {
          tx = await controller.deauthorizeLendersAndUpdateMarkets(
            authorizedLenders,
            markets,
          )
        } else {
          tx = await controller.deauthorizeLenders(authorizedLenders)
        }
        return tx.wait()
      }

      const receipt = await toastifyRequest(deauthorizeLenders(), {
        pending: "Removing Lenders...",
        success: "Lenders successfully removed!",
        error: "Error removing lenders",
      })
      await waitForSubgraphSync(receipt.blockNumber)
    },
    onSuccess() {
      client.invalidateQueries({ queryKey: [GET_LENDERS_BY_MARKET_KEY] })
    },
    onError(error) {
      toastifyError(`Error Removing Lenders: ${error}`)
    },
  })
}

export const useResetReserveRatio = (
  marketAccount: MarketAccount,
  controllerAddress: string,
) => {
  const { data: controller } = useGetControllerContract(controllerAddress)
  const client = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!controller) {
        toastifyError("Controller Not Found")
        return
      }
      const resetReserveRatio = async () => {
        const tx = await controller.resetReserveRatio(
          marketAccount.market.address,
        )
        return tx.wait()
      }

      const receipt = await toastifyRequest(resetReserveRatio(), {
        pending: "Resetting Reserve Ratio...",
        success: "Reserve Ratio successfully reset!",
        error: "Error resetting reserve ratio",
      })
      await waitForSubgraphSync(receipt.blockNumber)
    },
    onSuccess() {
      client.invalidateQueries({
        queryKey: [GET_BORROWER_MARKET_ACCOUNT_LEGACY_KEY],
      })
    },
    onError(error) {
      toastifyError(`Error Resetting Reserve Ratio: ${error}`)
    },
  })
}
