import React, { useState } from 'react'
import Sidebar from './components/Sidebar'
import DataPage from './components/DataPage'
import CleanPage from './components/CleanPage'
import DescribePage from './components/DescribePage'
import TestsPage from './components/TestsPage'
import AdvancedPage from './components/AdvancedPage'
import ModelsPage from './components/ModelsPage'
import WhatIfPage from './components/WhatIfPage'
import ReportPage from './components/ReportPage'

export default function App() {
  const [page, setPage] = useState('data')
  const [dataset, setDataset] = useState(null)
  const [activeModel, setActiveModel] = useState(null)

  const renderPage = () => {
    switch (page) {
      case 'data': return <DataPage dataset={dataset} setDataset={setDataset} />
      case 'clean': return <CleanPage dataset={dataset} setDataset={setDataset} />
      case 'describe': return <DescribePage dataset={dataset} />
      case 'tests': return <TestsPage dataset={dataset} />
      case 'advanced': return <AdvancedPage dataset={dataset} />
      case 'models': return <ModelsPage dataset={dataset} setActiveModel={setActiveModel} onGo={setPage} />
      case 'whatif': return <WhatIfPage dataset={dataset} activeModel={activeModel} setActiveModel={setActiveModel} />
      case 'report': return <ReportPage dataset={dataset} />
      default: return null
    }
  }

  return (
    <div className="ax-app">
      <Sidebar active={page} onGo={setPage} dataset={dataset} />
      <main className="ax-main">{renderPage()}</main>
    </div>
  )
}
