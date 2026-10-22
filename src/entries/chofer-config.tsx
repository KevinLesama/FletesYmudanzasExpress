import { mountWithAuth } from '../guard'
import { ChoferConfigPage } from '../pages/ChoferConfigPage'

mountWithAuth(['chofer'], <ChoferConfigPage />)
