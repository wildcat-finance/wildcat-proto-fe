import React, { useState } from "react"
import { Modal } from "../../../../components/ui-components"

import { RemoveLendersModalProps } from "./interface"

function RemoveLendersModal({ lenders }: RemoveLendersModalProps) {
  const [selectedLenders, setSelectedLenders] = useState<string[]>([])

  const isSelected = (lenderWallet: string) =>
    selectedLenders.includes(lenderWallet)

  const handleSelectLenderWallet = (lenderWallet: string) => {
    if (isSelected(lenderWallet)) {
      setSelectedLenders(
        selectedLenders.filter((lender) => lender !== lenderWallet),
      )
    } else {
      setSelectedLenders([...selectedLenders, lenderWallet])
    }
  }

  function clearInputOnClose() {
    setSelectedLenders([])
  }

  return (
    <Modal
      buttonName="Remove lenders"
      buttonColor="red"
      onClose={clearInputOnClose} // Устанавливаем функцию для очистки состояния при закрытии
    >
      <>
        <div className="text-base font-bold px-8">Remove Lenders</div>
        <div className="w-full border border-tint-10 my-3" />
        <div className="px-8">
          <div className="w-72 font-light text-xxs text-center mx-auto">
            Some text about what you are about to get yourself into and can you
            fulfill the params of doing this and make the text nice and
            descriptive but not too waffly.
          </div>
          <div className="flex flex-col items-center gap-y-2 mt-3">
            <div className="w-full border border-tint-10" />
            <div className="text-base font-bold">You have added:</div>
            {lenders.map((lender) => (
              <div className="flex gap-x-4" key={lender.lenderWallet}>
                <div className="flex flex-col justify-between w-full">
                  <div className="text-xs font-medium">{lender.lenderName}</div>
                  <div className="text-xs">{lender.lenderWallet}</div>
                </div>
                <div className="mt-2">
                  <input
                    type="checkbox"
                    name="RemoveLenderCheckbox"
                    onChange={() =>
                      handleSelectLenderWallet(lender.lenderWallet)
                    }
                    checked={isSelected(lender.lenderWallet)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    </Modal>
  )
}

export default RemoveLendersModal
