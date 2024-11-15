import { MarketAccount, TokenAmount } from "@wildcatfi/wildcat-sdk"
import { useEffect, useState } from "react"
import { useApprove } from "../../../../borrower/BorrowerMarketDetails/hooks/useVaultDetailActions"

export const useAllowanceCheck = (
  marketAccount: MarketAccount,
  tokenAmount: TokenAmount,
) => {
  const [hasInsufficientAllowance, setInsufficientAllowance] = useState(false)
  const { mutate: approve, isLoading: isApproving } = useApprove(
    marketAccount.market.underlyingToken,
    marketAccount.market,
    marketAccount.underlyingApproval,
  )

  useEffect(() => {
    if (!tokenAmount.raw.isZero()) {
      const { status } = marketAccount.checkDepositStep(tokenAmount)

      if (status === "InsufficientAllowance" && !hasInsufficientAllowance) {
        setInsufficientAllowance(true)
      }
      if (status !== "InsufficientAllowance" && hasInsufficientAllowance) {
        setInsufficientAllowance(false)
      }
    }
  }, [marketAccount, tokenAmount])

  const handleApprove = () => {
    if (!tokenAmount.raw.isZero()) {
      approve(tokenAmount)
    }
  }

  return {
    hasInsufficientAllowance,
    handleApprove,
    isApproving,
  }
}
