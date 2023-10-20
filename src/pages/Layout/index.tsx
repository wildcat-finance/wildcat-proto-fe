import { Outlet } from "react-router-dom"

import { Header } from "../../components/Header"

function Layout() {
  return (
    <div>
      <Header />

      <div className="p-10 w-full max-w-5xl mx-auto">
        <Outlet />
      </div>
    </div>
  )
}

export default Layout
