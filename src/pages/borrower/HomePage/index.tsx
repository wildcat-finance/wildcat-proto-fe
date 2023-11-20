import { Typography } from "../../../components/ui-components"

const HomePage = () => (
  <div>
    <Typography variant="h1">Hello, Stranger!</Typography>

    <div className="max-w-m text-m" style={{ padding: "1rem" }}>
      We don’t recognise the address that you’ve connected as belonging to a
      registered borrower on the <b>Sepolia testnet</b>.{"\n\n"}
    </div>

    <div className="max-w-m text-m" style={{ padding: "1rem" }}>
      If you’re helping us to test while we’re prepping for mainnet launch (or
      just want a look around), you can be added as a borrower on our mock
      archcontroller by{" "}
      <a
        target="_blank"
        href="mailto:laurence@wildcat.finance"
        rel="noreferrer"
        className="underline"
      >
        sending us{" "}
      </a>
      an address you want to be added.
    </div>

    <div className="max-w-m text-m" style={{ padding: "1rem" }}>
      Once you’re authorised, you’ll be able to deploy markets, add your own
      lenders, and generally tinker around.
    </div>

    <div className="max-w-m text-m" style={{ padding: "1rem" }}>
      Welcome, and thanks for checking out Wildcat!
    </div>
  </div>
)

export default HomePage
