import Channel from './Channel'
import Subscriptions from './Subscriptions'

export default {
  order: 2,
  nav: [],
  routes: [
    { path: '/channel/:uid', element: <Channel /> },
    { path: '/subscriptions', element: <Subscriptions /> },
  ],
}
