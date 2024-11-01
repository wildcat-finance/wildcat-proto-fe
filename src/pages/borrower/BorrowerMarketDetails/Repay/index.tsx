import React, { ChangeEvent, useMemo, useState } from "react"

import { constants } from "ethers"
import { Button } from "../../../../components/ui-components"
import { RepayModal } from "../Modals"
import {
  useApprove,
  useProcessUnpaidWithdrawalBatch,
  useRepay,
  useRepayOutstandingDebt,
} from "../hooks/useVaultDetailActions"
import { RepayProps } from "./interface"
import {
  formatTokenWithCommas,
  MARKET_PARAMS_DECIMALS,
  TOKEN_FORMAT_DECIMALS,
} from "../../../../utils/formatters"
import { DetailsInput } from "../../../../components/ui-components/DetailsInput"
import { SDK_ERRORS_MAPPING } from "../../../../utils/forms/errors"
import { useGnosisSafeSDK } from "../../../../hooks/useGnosisSafeSDK"
import { useTransactionWait } from "../../../../store/useTransactionWait"

const Repay = ({ marketAccount }: RepayProps) => {
  const { isTxInProgress, setisTxInProgress } = useTransactionWait()

  const [isModalOpen, setIsModalOpen] = useState(false)

  const toggleModal = () => setIsModalOpen(!isModalOpen)

  const { market } = marketAccount
  const [repayAmount, setRepayAmount] = useState("")

  const { mutateAsync: repay, isLoading: isRepayAmountLoading } =
    useRepay(marketAccount)

  const { isConnectedToSafe } = useGnosisSafeSDK()

  const {
    mutate: repayAndProcessUnpaidWithdrawalBatch,
    isLoading: isLoadingUnpaidWithdrawalBatch,
  } = useProcessUnpaidWithdrawalBatch(marketAccount)

  const {
    mutate: repayOutstandingDebt,
    isLoading: isRepayOutstandingDebtLoading,
  } = useRepayOutstandingDebt(marketAccount)

  const { mutate: approve, isLoading: isApproving } = useApprove(
    marketAccount.market.underlyingToken,
    marketAccount.market,
  )

  const [error, setError] = useState<string | undefined>()

  const handleRepayAmountChange = (evt: ChangeEvent<HTMLInputElement>) => {
    const { value } = evt.target
    setRepayAmount(value || "0")

    if (value === "" || value === "0") {
      setError(undefined)
      return
    }

    if (marketAccount.account === constants.AddressZero) {
      setError("Please connect your wallet")
      return
    }

    const repayTokenAmount = marketAccount.market.underlyingToken.parseAmount(
      value || "0",
    )

    const repayStep = marketAccount.previewRepay(repayTokenAmount)

    if (repayStep.status !== "Ready") {
      if (
        !(repayStep.status === "InsufficientAllowance" && isConnectedToSafe)
      ) {
        setError(SDK_ERRORS_MAPPING.repay[repayStep.status])
        return
      }
    }

    setError(undefined)
  }

  const { outstandingDebt, underlyingToken } = market

  const repayTokenAmount = useMemo(
    () => marketAccount.market.underlyingToken.parseAmount(repayAmount || "0"),
    [repayAmount],
  )
  const repayStep = marketAccount.previewRepay(repayTokenAmount)

  const isLoading =
    isRepayAmountLoading ||
    isRepayOutstandingDebtLoading ||
    isApproving ||
    isLoadingUnpaidWithdrawalBatch

  const marketDisabled = marketAccount.market.isClosed
  const repayDisabled =
    marketDisabled ||
    repayTokenAmount.raw.isZero() ||
    !!error ||
    isLoading ||
    isTxInProgress

  const repayOutstandingDisabled =
    marketDisabled ||
    outstandingDebt.raw.isZero() ||
    !marketAccount.canRepayOutstanding ||
    isLoading

  const handleApprove = () => {
    if (repayStep?.status === "InsufficientAllowance") {
      approve(repayTokenAmount)
    }
  }

  const handleRepay = () => {
    toggleModal()
    setisTxInProgress(true)
    if (!market.unpaidWithdrawalBatchExpiries.length) {
      repay(repayTokenAmount)
        .catch((e) => {
          console.log(e)
        })
        .finally(() => {
          setisTxInProgress(false)
        })
    } else {
      const { length } = market.unpaidWithdrawalBatchExpiries

      repayAndProcessUnpaidWithdrawalBatch({
        tokenAmount: repayTokenAmount,
        maxBatches: length,
      })
    }
  }

  const newMarketReserve = market.totalAssets.add(repayTokenAmount)

  return (
    <>
      <DetailsInput
        disabled={isTxInProgress}
        market={market}
        decimalScale={MARKET_PARAMS_DECIMALS.maxTotalSupply}
        className="w-full"
        placeholder="00,000.00"
        onChange={handleRepayAmountChange}
        helperText="Max. Repay"
        error={!!error}
        errorText={error}
        helperValue={`${formatTokenWithCommas(outstandingDebt, {
          withSymbol: true,
        })}`}
      />
      <div className="w-44 flex flex-col gap-y-1.5">
        {repayStep.status === "InsufficientAllowance" && !isConnectedToSafe ? (
          <Button
            variant="green"
            className="w-full"
            onClick={handleApprove}
            disabled={isApproving}
          >
            Approve
          </Button>
        ) : (
          <RepayModal
            disabled={repayDisabled}
            newMarketReserve={newMarketReserve.format(TOKEN_FORMAT_DECIMALS)}
            repayAmount={repayAmount}
            isLoading={isLoading}
            tokenSymbol={underlyingToken.symbol}
            repay={handleRepay}
            isOpen={isModalOpen}
            onClose={toggleModal}
          />
        )}
        <Button
          // @todo Disabled until this is fixed - should be delinquent not outstanding
          disabled
          variant="green"
          className="w-full px-2 whitespace-nowrap"
          onClick={repayOutstandingDebt}
        >
          Repay To Minimum Reserves
        </Button>
      </div>
    </>
  )
}

export default Repay
