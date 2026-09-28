import { nowPage } from './data'
import { TextPage } from './components/TextPage'
import { mount } from './lib/mount'

mount(<TextPage page={nowPage} />)
