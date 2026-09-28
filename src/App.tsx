import { Navigate, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import PlayEntry from './child/PlayEntry'
import WorldMap from './child/WorldMap'
import PlaySession from './child/PlaySession'
import RewardScreen from './child/RewardScreen'
import Login from './therapist/pages/Login'
import Overview from './therapist/pages/Overview'
import ChildDetail from './therapist/pages/ChildDetail'
import SessionDetail from './therapist/pages/SessionDetail'

export default function App() { return <Routes>
  <Route path="/" element={<Landing />} />
  <Route path="/play" element={<PlayEntry />} />
  <Route path="/play/map" element={<WorldMap />} />
  <Route path="/play/session/:id" element={<PlaySession />} />
  <Route path="/play/reward" element={<RewardScreen />} />
  <Route path="/therapist/login" element={<Login />} />
  <Route path="/therapist" element={<Overview />} />
  <Route path="/therapist/children/:id" element={<ChildDetail />} />
  <Route path="/therapist/sessions/:id" element={<SessionDetail />} />
  <Route path="*" element={<Navigate to="/" />} />
</Routes> }
