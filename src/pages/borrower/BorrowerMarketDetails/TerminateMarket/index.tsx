import { CloseMarketStatus, minTokenAmount } from "@wildcatfi/wildcat-sdk"
import { useState } from "react"
import { Button } from "../../../../components/ui-components"
import { toastifyError, toastifyInfo } from "../../../../components/toasts"
import { TOKEN_FORMAT_DECIMALS } from "../../../../utils/formatters"
import { ButtonProps } from "../../../../components/ui-components/Button/interface"
import { TerminateMarketProps } from "./type"
import {
  useAdjustAPR,
  useApprove,
  useProcessUnpaidWithdrawalBatch,
  useTerminateMarket,
} from "../hooks/useVaultDetailActions"
import { useTransactionWait } from "../../../../store/useTransactionWait"

export const TerminateMarket = ({ marketAccount }: TerminateMarketProps) => {
  const { mutateAsync: approve, isLoading: isApproving } = useApprove(
    marketAccount.market.underlyingToken,
    marketAccount.market,
    marketAccount.underlyingApproval,
  )
  const {
    mutateAsync: repayAndProcessUnpaidWithdrawalBatch,
    isLoading: isProcessing,
  } = useProcessUnpaidWithdrawalBatch(marketAccount)
  const { mutate: terminateMarket, isLoading: terminateMarketLoading } =
    useTerminateMarket(marketAccount)
  const { isLoading: adjustAprLoading } = useAdjustAPR(marketAccount)

  const [isTerminating, setIsTerminating] = useState(false)
  const { isTxInProgress } = useTransactionWait()

  const { market } = marketAccount
  const terminateMarketStep = marketAccount.checkCloseMarketStep()

  const handleTerminateMarket = () => {
    if (!isTerminating) {
      setIsTerminating(true)
      if (terminateMarketStep.status === "InsufficientAllowance") {
        toastifyInfo(
          `Need to approve ${terminateMarketStep.remainder.format(
            TOKEN_FORMAT_DECIMALS,
            true,
          )} `,
        )
      } else if (terminateMarketStep.status === "UnpaidWithdrawalBatches") {
        toastifyInfo(
          `Need to process ${market.unpaidWithdrawalBatchExpiries.length} unpaid withdrawal batches before closing market`,
        )
      }
      return
    }

    if (terminateMarketStep.status === "InsufficientAllowance") {
      approve(terminateMarketStep.remainder)
        .then(() => {
          if (market.unpaidWithdrawalBatchExpiries.length) {
            toastifyInfo(
              `Need to process ${market.unpaidWithdrawalBatchExpiries.length} unpaid withdrawal batches before closing market`,
            )
          }
        })
        .catch(() => {})
    } else if (terminateMarketStep.status === "UnpaidWithdrawalBatches") {
      const { length } = market.unpaidWithdrawalBatchExpiries
      const repayAmount = minTokenAmount(
        market.outstandingDebt,
        market.underlyingToken.getAmount(marketAccount.underlyingApproval),
      )
      repayAndProcessUnpaidWithdrawalBatch({
        tokenAmount: repayAmount,
        maxBatches: length,
      })
    } else if (terminateMarketStep.status !== "Ready") {
      toastifyError(terminateMarketStep.status)
    } else {
      terminateMarket()
    }
  }

  const getButtonTextAndColor = (
    isActive: boolean,
    step: CloseMarketStatus,
  ): [string, ButtonProps["variant"]] => {
    if (isActive && step.status === "InsufficientAllowance") {
      return ["Approve", "green"]
    }
    if (isActive && step.status === "UnpaidWithdrawalBatches") {
      return ["Close Unpaid Batch", "green"]
    }
    return ["Terminate Market", "red"]
  }

  const [terminateButtonText, terminateButtonColor] = getButtonTextAndColor(
    isTerminating,
    terminateMarketStep,
  )

  const isLoading =
    adjustAprLoading || terminateMarketLoading || isProcessing || isApproving

  const marketDisabled = marketAccount.market.isClosed

  return (
    <Button
      variant={terminateButtonColor}
      className="w-44 px-2 whitespace-nowrap mr-7"
      onClick={handleTerminateMarket}
      disabled={marketDisabled || isLoading || isTxInProgress}
    >
      {terminateButtonText}
    </Button>
  )
}
