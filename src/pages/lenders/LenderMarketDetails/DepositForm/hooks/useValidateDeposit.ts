import { useMemo } from "react"
import { useForm } from "react-hook-form"
import z from "zod"
import { MarketAccount } from "@wildcatfi/wildcat-sdk"
import { zodResolver } from "@hookform/resolvers/zod"

import { vschema, DepositValidationType } from "./validationSchema"
import { SDK_ERRORS_MAPPING } from "../../../../../utils/forms/errors"

const defaultValues = {
  depositAmount: "",
}

export const useDepositForm = (marketAccount: MarketAccount) => {
  const validationSchemaAsync = useMemo(() => {
    if (marketAccount) {
      return vschema.extend({
        depositAmount: vschema.shape.depositAmount.superRefine(
          (depositAmount, ctx) => {
            const tokenAmount =
              marketAccount.market.underlyingToken.parseAmount(
                depositAmount || "0",
              )
            const { status } = marketAccount.previewDeposit(tokenAmount)

            if (status !== "Ready" && status !== "InsufficientAllowance") {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: SDK_ERRORS_MAPPING.deposit[status],
              })
            }
          },
        ),
      })
    }

    return vschema
  }, [marketAccount])

  return useForm<DepositValidationType>({
    defaultValues,
    resolver: zodResolver(validationSchemaAsync),
    mode: "onChange",
  })
}
