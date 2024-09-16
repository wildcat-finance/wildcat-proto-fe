import { TokenAmount } from "@wildcatfi/wildcat-sdk"
import humanizeDuration from "humanize-duration"
import { FaExclamationCircle } from "react-icons/fa"
import { useMemo } from "react"
import { TableItem } from "../../../../components/ui-components"
import {
  formatBps,
  formatSecsToHours,
  MARKET_PARAMS_DECIMALS,
  TOKEN_FORMAT_DECIMALS,
  trimAddress,
} from "../../../../utils/formatters"

import type { BorrowerMarketOverviewProps } from "./interface"
import { EtherscanLink } from "../../../../components/ui-components/EtherscanLink"
import { useBorrowerNameOrAddress } from "../../../../hooks/useBorrowerNames"

const localize = (
  tokenAmount: TokenAmount,
  decimals = TOKEN_FORMAT_DECIMALS,
  withSymbol = false,
) => {
  const text = tokenAmount.format(decimals)
  const [beforeDecimal, afterDecimal] = text.split(".")
  const beforeDecimalWithCommas = Number(beforeDecimal).toLocaleString("en-US")
  return [
    beforeDecimalWithCommas,
    ...(afterDecimal !== undefined ? [".", afterDecimal] : []),
    ...(withSymbol ? [" ", tokenAmount.symbol] : []),
  ].join("")
}

const toTokenAmountProps = (
  tokenAmount: TokenAmount | undefined,
  defaultText = "-",
) => ({
  value: tokenAmount
    ? localize(tokenAmount, TOKEN_FORMAT_DECIMALS, true)
    : defaultText,
  valueTooltip: tokenAmount?.format(tokenAmount.decimals, true),
})

const BorrowerMarketOverview = ({ market }: BorrowerMarketOverviewProps) => {
  const {
    address,
    underlyingToken,
    annualInterestBips,
    maxTotalSupply,
    reserveRatioBips,
    timeDelinquent,
    delinquencyGracePeriod,
    marketToken,
    withdrawalBatchDuration,
    delinquencyFeeBips,
  } = market

  const totalInterestAccrued = (
    market.totalDelinquencyFeesAccrued ?? underlyingToken.getAmount(0)
  ).add(market.totalBaseInterestAccrued ?? 0)

  const borrowerName = useBorrowerNameOrAddress(market.borrower)
  const [gracePeriodLabel, gracePeriodTimer] =
    timeDelinquent > delinquencyGracePeriod
      ? [
          "Remaining Time With Delinquency Fees",
          humanizeDuration((timeDelinquent - delinquencyGracePeriod) * 1000, {
            round: true,
            largest: 2,
          }),
        ]
      : [
          "Available Grace Period",
          formatSecsToHours(delinquencyGracePeriod - timeDelinquent),
        ]

  const warningText = useMemo(() => {
    const breakdown = market.getTotalDebtBreakdown()
    const willBeDelinquent = breakdown.status === "delinquent"
    if (!market.isDelinquent && willBeDelinquent) {
      return "The delinquency timer will only begin ticking after a market update."
    }
    if (!willBeDelinquent && timeDelinquent > delinquencyGracePeriod) {
      return "The market is not currently delinquent, but penalty fees will apply until the delinquency timer is below the grace period."
    }
    return undefined
  }, [market])

  return (
    <div>
      <div className="text-base font-bold">Market Details</div>
      <div className="flex w-full mt-5 mb-14">
        <div className="w-full">
          <TableItem title="Market Token" className="pl-6 pr-24">
            <EtherscanLink kind="token" value={address}>
              {marketToken.symbol} ({trimAddress(marketToken.address)})
            </EtherscanLink>
          </TableItem>
          <TableItem title="Underlying Asset" className="pl-6 pr-24">
            <EtherscanLink kind="token" value={underlyingToken.address}>
              {underlyingToken.symbol} ({trimAddress(underlyingToken.address)})
            </EtherscanLink>
          </TableItem>
          <TableItem title="Borrower" className="pl-6 pr-24">
            <EtherscanLink kind="address" value={market.borrower}>
              {borrowerName}
            </EtherscanLink>
          </TableItem>
          <TableItem
            title="Base APR"
            value={`${formatBps(
              annualInterestBips,
              MARKET_PARAMS_DECIMALS.annualInterestBips,
            )}%`}
            className="pl-6 pr-24"
          />
          <TableItem
            title="Max. Borrowing Capacity"
            value={`${Number(
              maxTotalSupply.format(TOKEN_FORMAT_DECIMALS),
            ).toLocaleString("en-US")} ${underlyingToken.symbol}`}
            className="pl-6 pr-24"
          />
          <TableItem
            title="Min. Reserve Ratio"
            value={`${formatBps(
              reserveRatioBips,
              MARKET_PARAMS_DECIMALS.reserveRatioBips,
            )}%`}
            className="pl-6 pr-24"
          />
        </div>
        <div className="w-full">
          <TableItem
            title="Penalty APR"
            value={`${formatBps(
              delinquencyFeeBips,
              MARKET_PARAMS_DECIMALS.delinquencyFeeBips,
            )}%`}
            className="pr-6 pl-24"
          />
          <TableItem
            title="Total Interest Accrued"
            className="pr-6 pl-24"
            {...toTokenAmountProps(totalInterestAccrued)}
            titleTooltip="Total accrued from delinquency fees and base interest"
          />
          <TableItem
            title="Total Protocol Fees"
            className="pr-6 pl-24"
            {...toTokenAmountProps(market.totalProtocolFeesAccrued)}
            titleTooltip="Total accrued in protocol fees"
          />
          <TableItem
            title="Withdrawal Cycle Duration"
            value={formatSecsToHours(withdrawalBatchDuration)}
            className="pr-6 pl-24"
          />
          <TableItem
            title="Max. Grace Period"
            value={formatSecsToHours(delinquencyGracePeriod)}
            className="pr-6 pl-24"
          />
          <TableItem
            title={gracePeriodLabel}
            valueTooltip={warningText}
            value={
              warningText ? (
                <span className="flex justify-center items-center gap-2">
                  {gracePeriodTimer}
                  <FaExclamationCircle height={12} color="orange" />
                </span>
              ) : (
                gracePeriodTimer
              )
            }
            className="pr-6 pl-24"
          />
        </div>
      </div>
    </div>
  )
}

export default BorrowerMarketOverview
