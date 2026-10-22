import { mountWithAuth } from '../guard'
import { ChoferPage } from '../pages/ChoferPage'

mountWithAuth(['chofer'], <ChoferPage />)
