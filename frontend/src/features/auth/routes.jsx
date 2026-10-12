import Login from './Login'
import Signup from './Signup'

export default {
  order: 99,
  nav: [],
  routes: [
    { path: '/login', element: <Login /> },
    { path: '/signup', element: <Signup /> },
  ],
}
