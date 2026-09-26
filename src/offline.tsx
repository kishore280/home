import { OfflinePage } from './components/OfflinePage'
import type { Connection } from './lib/client'
import { mount } from './lib/mount'

// Hydrate in the state this HTML was pre-rendered in (see OfflinePage).
const initial = (document.querySelector('main')?.dataset.connection ?? 'online') as Connection
mount(<OfflinePage initial={initial} />)
