import React from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import DashboardPage from './components/DashboardPage'
import ProjectsPage from './components/ProjectsPage'
import FilesPage from './components/FilesPage'
import ProjectWorkspace from './components/ProjectWorkspace'
import { ThemeProvider } from './theme'
import { ToastProvider } from './ui/Toast'
import { ConfirmProvider } from './ui/Confirm'
import ErrorBoundary from './ui/ErrorBoundary'

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <BrowserRouter>
            <div className="ax-app">
              <Sidebar />
              <main className="ax-main">
                <ErrorBoundary>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/projects" element={<ProjectsPage />} />
                    <Route path="/projects/:id" element={<Navigate to="data" replace />} />
                    <Route path="/projects/:id/:tab" element={<ProjectWorkspace />} />
                    <Route path="/files" element={<FilesPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </ErrorBoundary>
              </main>
            </div>
          </BrowserRouter>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
