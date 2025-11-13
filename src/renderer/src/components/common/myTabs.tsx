import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
interface Tab {
  label: string
  value: string
  icon: React.JSX.Element
}
interface Props {
  tabs: Tab[]
}
const MyTabs = ({ tabs }: Props): React.JSX.Element => {
  return (
    <Tabs defaultValue={tabs[0].value}>
      <TabsList>
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
