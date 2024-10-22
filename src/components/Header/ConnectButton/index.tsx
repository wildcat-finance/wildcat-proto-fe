import { RiWallet3Line, RiCloseLine } from "react-icons/ri"
import { Fragment, useCallback, useEffect, useMemo } from "react"
import { useAccount, useConnect, useDisconnect, useSwitchNetwork } from "wagmi"
import { Dialog, Transition } from "@headlessui/react"

import { useCopyToClipboard } from "react-use"
import { Button, Paper } from "../../ui-components"
import { useWalletConnectModalStore } from "../../../store/useWalletConnectModalStore"
import { TargetChainId, TargetNetwork } from "../../../config/networks"
import { useCurrentNetwork } from "../../../hooks/useCurrentNetwork"
import { trimAddress } from "../../../utils/formatters"
import { CopyIcon } from "../../ui-components/icons"
import { toastifyError, toastifyInfo } from "../../toasts"

import { ReactComponent as WalletConnect } from "../../../images/wallet-connect.svg"
import { ReactComponent as MetaMask } from "../../../images/MetaMask_Fox.svg"
import { ReactComponent as Coinbase } from "../../../images/coinbase.svg"
import { ReactComponent as Ledger } from "../../../images/ledger.svg"

type SVGComponent = React.FunctionComponent<
  React.SVGProps<SVGSVGElement> & {
    title?: string | undefined
  }
>

const WalletIcons: Record<string, SVGComponent> = {
  walletConnect: WalletConnect,
  injected: MetaMask,
  coinbaseWallet: Coinbase,
  ledger: Ledger,
}

const WalletIcon = ({
  id,
  ...props
}: { id: string } & React.SVGProps<SVGSVGElement>) => {
  const Icon = WalletIcons[id]
  return Icon ? <Icon {...props} /> : null
}

function ConnectButton() {
  const [state, copyToClipboard] = useCopyToClipboard()
  const { isOpen, setIsWalletModalOpen } = useWalletConnectModalStore()

  const { connectors, connect, isLoading, pendingConnector } = useConnect()
  const { address, isConnected } = useAccount()
  const { switchNetwork } = useSwitchNetwork()
  const { disconnect } = useDisconnect()
  const { isWrongNetwork } = useCurrentNetwork()

  useEffect(() => {
    if (isConnected && !isWrongNetwork) {
      setIsWalletModalOpen(false)
    }
  }, [isConnected, isWrongNetwork])

  const openModal = useCallback(() => {
    if (!isOpen) {
      setIsWalletModalOpen(true)
    }
  }, [isOpen])

  const closeModal = useCallback(() => {
    console.log(`closeModal`)
    // if (isOpen) {
    setIsWalletModalOpen(false)
    // }
  }, [isOpen])

  const getButtonText = useCallback(() => {
    if (isConnected && isWrongNetwork) {
      return "Wrong Network"
    }
    if (isConnected && address) {
      return `${address.slice(0, 6)}..${address.slice(-4, address.length)}`
    }
    return "Connect"
  }, [isConnected, address, isWrongNetwork])

  const shortenedAddress = useMemo(
    () => (address ? trimAddress(address) : null),
    [address],
  )

  const handleCopyAddress = (text: string) => {
    copyToClipboard(text)
    if (state.error) {
      toastifyError("Failed to copy to clipboard")
    } else {
      toastifyInfo("Address copied to clipboard")
    }
  }

  return (
    <>
      <Button className="rounded-sm" onClick={openModal} variant="silver">
        <div className="flex items-center gap-2">
          <span className="text-black text-xs">{getButtonText()}</span>
          <RiWallet3Line className="w-4 h-4" />
        </div>
      </Button>
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-10"
          onClose={() => !isLoading && closeModal()}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 backdrop-blur-md" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="transform transition-all w-full max-w-sm sm:max-w-sm md:max-w-md lg:max-w-[24rem]">
                  <div className="flex flex-col items-center">
                    <Paper className="bg-sand p-2 sm:p-4 rounded-sm w-full">
                      <div className="flex items-center justify-center mb-4 relative">
                        <p className="text-2xl font-medium select-none">
                          {isConnected ? "Account" : "Select Wallet"}
                        </p>
                        <RiCloseLine
                          className="absolute right-0 top-1/2 transform -translate-y-1/2 w-6 h-6 cursor-pointer"
                          onClick={closeModal}
                        />
                      </div>
                      <div className="flex items-center justify-center h-full flex-col gap-2 px-4 sm:px-6 pb-3 md:py-2 overflow-y-auto max-h-[60vh]">
                        {isConnected && isWrongNetwork && (
                          <Button
                            variant="silver"
                            className="w-full"
                            onClick={() => switchNetwork?.(TargetChainId)}
                          >
                            Switch to {TargetNetwork.name}
                          </Button>
                        )}
                        {isConnected ? (
                          <>
                            <button
                              onClick={() => handleCopyAddress(String(address))}
                            >
                              <div className="flex flex-row items-center gap-x-2 mb-1">
                                <p className="hover:underline">
                                  {shortenedAddress}
                                </p>
                                <CopyIcon className="w-4 h-4 opacity-50 hover:opacity-100" />
                              </div>
                            </button>

                            <Button
                              variant="black"
                              className="w-full"
                              onClick={() => disconnect()}
                            >
                              Disconnect
                            </Button>
                          </>
                        ) : (
                          <>
                            {connectors
                              .filter((c) => !(c.name === "Safe" && !c.ready))
                              .map((connector) => (
                                <Button
                                  disabled={!connector.ready}
                                  key={connector.id}
                                  rounded="2xl"
                                  onClick={() => connect({ connector })}
                                  variant="black"
                                  className="w-full h-full flex flex-row justify-start pt-2 pb-2 !px-2 sm:!px-4"
                                >
                                  <div className="rounded-sm bg-white flex flex-row justify-center items-center p-1">
                                    <WalletIcon
                                      id={connector.id}
                                      className="h-8 w-8 lg:h-10 lg:w-10"
                                      // style={{ maxWidth: "100%" }}
                                    />
                                  </div>
                                  <div
                                    style={{ marginLeft: "auto" }}
                                    className="basis-4/5 flex-row items-center justify-center"
                                  >
                                    <span className="text-lg md:text-xl">
                                      {connector.name}
                                      {!connector.ready && " (unsupported)"}
                                      {isLoading &&
                                        connector.id === pendingConnector?.id &&
                                        " (connecting)"}
                                    </span>
                                  </div>
                                </Button>
                              ))}
                          </>
                        )}
                      </div>
                    </Paper>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  )
}

export default ConnectButton
