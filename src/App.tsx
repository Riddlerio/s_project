import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import PlayEntry from './child/PlayEntry'
import WorldMap from './child/WorldMap'
import RewardScreen from './child/RewardScreen'
import Login from './therapist/pages/Login'
import Overview from './therapist/pages/Overview'

const CharacterHome = lazy(() => import('./child/CharacterHome'))
const ActivitySession = lazy(() => import('./child/ActivitySession'))
const HoyaChat = lazy(() => import('./child/HoyaChat'))
const ChildDetail = lazy(() => import('./therapist/pages/ChildDetail'))
const SessionDetail = lazy(() => import('./therapist/pages/SessionDetail'))

export default function App() { return <Suspense fallback={<main>두두가 준비하고 있어요…</main>}><Routes>
  <Route path="/" element={<Landing />} />
  <Route path="/play" element={<PlayEntry />} />
  <Route path="/play/home" element={<CharacterHome />} />
  <Route path="/play/map" element={<WorldMap />} />
  <Route path="/play/chat" element={<HoyaChat />} />
  <Route path="/play/activity/:id" element={<ActivitySession />} />
  <Route path="/play/reward" element={<RewardScreen />} />
  <Route path="/therapist/login" element={<Login />} />
  <Route path="/therapist" element={<Overview />} />
  <Route path="/therapist/children/:id" element={<ChildDetail />} />
  <Route path="/therapist/sessions/:id" element={<SessionDetail />} />
  <Route path="*" element={<Navigate to="/" />} />
</Routes></Suspense> }
