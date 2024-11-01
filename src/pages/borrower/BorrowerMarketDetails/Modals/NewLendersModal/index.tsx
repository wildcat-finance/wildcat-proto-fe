import { useState, ChangeEvent, useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import cancelRoundRedIcon from "../../../../../components/ui-components/icons/cancel_round_red.svg"
import {
  Button,
  FormItem,
  Modal,
  TextInput,
} from "../../../../../components/ui-components"

import {
  NewLenderFormSchema,
  newLenderValisationSchema,
} from "./validationSchema"
import { useAuthoriseLenders } from "../../hooks/useVaultDetailActions"
import { NewLendersModalProps } from "./interface"

const newLenderFormDefaults: NewLenderFormSchema = {
  lenderWallet: "",
}

export function NewLendersModal({ market }: NewLendersModalProps) {
  const { setValue, getValues, watch, reset } = useForm<NewLenderFormSchema>({
    resolver: zodResolver(newLenderValisationSchema),
    defaultValues: newLenderFormDefaults,
    reValidateMode: "onBlur",
  })
  const [newLenders, setNewLenders] = useState<NewLenderFormSchema[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const lendersAddresses = newLenders.map((lender) => lender.lenderWallet)

  const {
    mutate: authorize,
    isLoading,
    isSuccess,
  } = useAuthoriseLenders(lendersAddresses, market.controller!)

  const handleChangeInput = (evt: ChangeEvent<HTMLInputElement>) => {
    const { value } = evt.target
    const name = evt.target.name as keyof NewLenderFormSchema

    setValue(name, value)
  }

  const handleAddLender = () => {
    const newLender = getValues()

    setNewLenders([...newLenders, newLender])
    reset()
  }

  const formValues = watch()

  const clearInputOnClose = () => {
    setNewLenders([])
    reset()
  }

  const handleCancelLender = (lenderToRemove: NewLenderFormSchema) => {
    const updatedLenders = newLenders.filter(
      (lender) => lender !== lenderToRemove,
    )
    setNewLenders(updatedLenders)
  }

  const onModalClose = () => {
    setIsModalOpen(false)
    clearInputOnClose()
  }

  useEffect(() => {
    if (isSuccess) {
      onModalClose()
    }
  }, [isSuccess])

  const marketDisabled = market.isClosed
  const disabled = marketDisabled || isLoading

  return (
    <>
      <Button
        variant="glacier"
        className="w-35 whitespace-nowrap"
        disabled={disabled}
        onClick={() => setIsModalOpen(true)}
      >
        Authorise Lenders
      </Button>

      <Modal
        isOpen={isModalOpen}
        onClose={onModalClose}
        onClick={authorize}
        isLoading={isLoading}
        firstBtnText="Confirm"
      >
        <div className="text-base font-bold px-8">Onboard New Lender/s</div>

        <div className="w-full border border-tint-10 my-3" />

        <div className="flex flex-col items-center gap-y-5 px-8">
          <div className="w-72 font-light text-xxs text-center ">
            Please provide a wallet address for each new lender you want to
            authorise for this market.
          </div>
          <FormItem className="w-full" label="Lender Wallet Address">
            <TextInput
              name="lenderWallet"
              value={formValues.lenderWallet}
              onChange={handleChangeInput}
              className="w-full bg-tint-11"
              placeholder="e.g.: 0x863DF6BFa4469f3ead0bE8f9F2AAE51c91A907b4"
            />
          </FormItem>
          <Button
            disabled={isLoading}
            variant="glacier"
            className="w-28"
            onClick={handleAddLender}
          >
            Add
          </Button>
          <div className="flex flex-col gap-y-2 w-full">
            <div className="w-full border border-tint-10" />

            <div className="text-base font-bold text-center">
              You Are Adding:
            </div>

            {newLenders.map((lender) => (
              <div className="flex gap-x-4" key={lender.lenderWallet}>
                <div className="flex flex-col justify-between w-full">
                  <div className="text-xs">{lender.lenderWallet}</div>
                </div>
                <Button
                  onClick={() => handleCancelLender(lender)}
                  variant="outline"
                  disabled={isLoading}
                >
                  <img
                    className="w-5 h-5"
                    src={cancelRoundRedIcon}
                    alt="Cancel"
                  />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </>
  )
}

export default NewLendersModal
