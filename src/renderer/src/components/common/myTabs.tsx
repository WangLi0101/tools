import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useNavigate } from 'react-router-dom'
interface Tab {
  label: string
  value: string
  icon: React.JSX.Element
  url: string
}
interface Props {
  tabs: Tab[]
}
const MyTabs = ({ tabs }: Props): React.JSX.Element => {
  const navigate = useNavigate()
  const go = (url: string) => {
    navigate(url)
  }
  return (
    <Tabs defaultValue={tabs[0].value} onValueChange={(v) => go(v)}>
      <TabsList className="rounded-full w-full">
        {tabs.map((item) => (
          <TabsTrigger value={item.value} key={item.value}>
            {item.icon}
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
export default MyTabs
