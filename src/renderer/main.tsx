import ReactDOM from 'react-dom/client'
import App from '@renderer/App'
import ScreenshotOverlay from '@renderer/components/ScreenshotOverlay'
import { ErrorBoundary } from '@renderer/components/ErrorBoundary'
import '@renderer/styles/global.css'

const params = new URLSearchParams(window.location.search)
const isCapture = params.get('mode') === 'capture'

if (isCapture) {
  document.documentElement.setAttribute('data-capture', 'true')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary name="Root">
    {isCapture ? <ScreenshotOverlay /> : <App />}
  </ErrorBoundary>
)
