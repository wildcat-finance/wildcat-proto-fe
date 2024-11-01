import { Market, SetAprPreview, SetAprStatus } from "@wildcatfi/wildcat-sdk"
import dayjs from "dayjs"
import cn from "classnames"
import { ChangeEvent, ReactNode, useState } from "react"
import { Modal } from "../../../../../components/ui-components"
import { AdjustAprModalProps } from "./interface"
import {
  formatBps,
  MARKET_PARAMS_DECIMALS,
  TOKEN_FORMAT_DECIMALS,
} from "../../../../../utils/formatters"
import { DetailsInput } from "../../../../../components/ui-components/DetailsInput"
import { useTransactionWait } from "../../../../../store/useTransactionWait"
import { SDK_ERRORS_MAPPING } from "../../../../../utils/forms/errors"
import { useAdjustAPR } from "../../hooks/useVaultDetailActions"

const DATE_FORMAT = "DD-MMM-YYYY HH:mm"
const PreviousTemporaryReserveRatio = ({
  market, // status,
}: {
  market: Market
  // status: SetAprStatus
}) => {
  if (!market.temporaryReserveRatio) return null

  const [currentReserve, originalReserve, currentAPR, originalAPR] = [
    market.reserveRatioBips,
    market.originalReserveRatioBips,
    market.annualInterestBips,
    market.originalAnnualInterestBips,
  ].map(
    (bips) => `${formatBps(bips, MARKET_PARAMS_DECIMALS.reserveRatioBips)}%`,
  )

  return (
    <>
      <div className="flex flex-col items-center gap-y-2 px-8">
        <div className="w-72 text-xxs font-bold text-center">
          This market has a temporary reserve ratio of {currentReserve} because
          of a previous APR reduction.
        </div>
        <div className="w-72 text-xxs">
          <span className="font-bold">Previous change:</span> Reduced APR from{" "}
          {originalAPR} to {currentAPR}
          <br />
          <span className="font-bold">Can be reset at:</span>{" "}
          {dayjs(market.temporaryReserveRatioExpiry * 1000).format(DATE_FORMAT)}
        </div>
        <div className="w-72 text-xxs">
          The temporary reserve ratio can also be reset by increasing the APR to
          the original APR or higher.
        </div>
      </div>
      <div className="w-full border border-tint-10 my-3" />
    </>
  )
}

const Bold = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => <span className={cn("font-bold", className)}>{children}</span>

const NewReserveRatioMessage = ({
  status,
  market,
  newAPR,
}: {
  status: SetAprPreview
  market: Market
  newAPR: number
}) => {
  if (status.status !== "InsufficientReserves" && !(status.status === "Ready"))
    return null

  if (
    newAPR * 100 > market.annualInterestBips &&
    status.status === "Ready" &&
    !status.willChangeReserveRatio
  ) {
    return null
  }

  if (
    status.status === "Ready" &&
    status.willChangeReserveRatio &&
    status.changeCausedByReset
  ) {
    return (
      <div className="w-72 text-xxs text-center">
        This change will reset the temporary reserve ratio to the original{" "}
        <Bold>{formatBps(market.originalReserveRatioBips)}%</Bold>
      </div>
    )
  }
  const [, originalAnnualInterestBips] =
    market.originalReserveRatioAndAnnualInterestBips
  return (
    <div className="w-72 font-light text-xxs text-center">
      This is a reduction of{" "}
      <Bold>
        {
          +(
            ((originalAnnualInterestBips - newAPR * 100) * 100) /
            originalAnnualInterestBips
          ).toFixed(2)
        }
        %
      </Bold>{" "}
      {market.temporaryReserveRatio &&
        `(from the original ${formatBps(originalAnnualInterestBips)}%) `}
      and will impose a temporary reserve ratio of{" "}
      <Bold>
        {formatBps(
          "newReserveRatio" in status
            ? status.newReserveRatio
            : market.reserveRatioBips,
        )}
        %
      </Bold>
    </div>
  )
}

const NewRequiredReserves = ({ status }: { status: SetAprPreview }) => {
  if (
    status.status !== "InsufficientReserves" &&
    !(status.status === "Ready" && status.willChangeReserveRatio)
  )
    return null
  // if (status.status === "InsufficientReserves") {
  return (
    <div className="w-72 text-xxs">
      New Collateral Obligation:{" "}
      <Bold>
        {status.newCoverageLiquidity.format(TOKEN_FORMAT_DECIMALS, true)}
      </Bold>{" "}
      {status.status === "InsufficientReserves" &&
        status.changeCausedByReset && (
          <>
            <br />
            <Bold className="text-red-error">
              Can not reset reserve ratio while market is delinquent.
            </Bold>
          </>
        )}
    </div>
  )
}

type OtherProps = {
  error: string | undefined
  onChange: (evt: ChangeEvent<HTMLInputElement>) => void
  apr: string
  status: SetAprPreview | undefined
}

export const AdjustAPRModal = ({
  onClose,
  isOpen = false,
  currentAPR,
  isLoading,
  marketAccount,
  apr,
  status,
  adjustAPR,
  error,
  onChange,
}: AdjustAprModalProps & OtherProps) => {
  const { market } = marketAccount

  const newAPR = parseFloat(apr)
  const willChangeAPR =
    status?.status === "Ready" &&
    (status.willChangeReserveRatio ||
      newAPR * 100 !== market.annualInterestBips)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      isLoading={isLoading}
      onClick={adjustAPR}
      firstBtnText="Confirm"
      firstBtnDisabled={!willChangeAPR}
      // eslint-disable-next-line no-nested-ternary
      firstBtnVariant={error ? "red" : "glacier"}
    >
      <div>
        <div className="text-base font-bold px-8 w-100 text-center">
          Adjust Lender APR
        </div>

        <div className="w-full border border-tint-10 my-3" />

        <PreviousTemporaryReserveRatio market={market} />

        <div className="flex flex-col items-center gap-y-5 px-8">
          <div className="flex flex-col items-start justify-center w-72">
            <span className="w-72 font-bold text-xxs text-center">New APR</span>
            <div className="w-72">
              <DetailsInput
                decimalScale={MARKET_PARAMS_DECIMALS.annualInterestBips}
                placeholder="00.00"
                value={apr}
                onChange={onChange}
                error={!!error}
                market={market}
                helperText={`Current: ${market.annualInterestBips / 100}%`}
                errorText={error}
              />
            </div>

            {status && <NewRequiredReserves status={status} />}
          </div>
          {willChangeAPR && (
            <div className="w-72 text-xxs font-light text-center">
              By confirming this transaction, you are changing the base interest
              rate paid to your lenders from <Bold>{currentAPR}%</Bold> to{" "}
              <Bold>{newAPR}%</Bold>
            </div>
          )}

          {status && (
            <NewReserveRatioMessage
              status={status}
              newAPR={newAPR}
              market={market}
            />
          )}

          <div className="w-72 font-light text-xxs text-center">
            To avoid surprises, please make sure you have aligned this change
            with your active lenders before moving ahead.
          </div>
        </div>
      </div>
    </Modal>
  )
}
