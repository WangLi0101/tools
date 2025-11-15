import { useCallback, useState } from 'react'
import GoHome from '@/components/common/goHome'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Download, FileDown } from 'lucide-react'
import { toast } from 'sonner'

const Pdf = (): React.JSX.Element => {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState('')
  const [outputPath, setOutputPath] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const onGenerate = useCallback(async (): Promise<void> => {
    try {
      setStatus('')
      setOutputPath('')
      const u = url.trim()
      if (!u) {
        toast.error('请输入URL')
        return
      }
      try {
        new URL(u)
      } catch {
        toast.error('URL格式不正确')
        return
      }
      setLoading(true)
      setStatus('正在生成PDF...')
      const res = await window.playwright.exportPdf(u)
      if (typeof res === 'string' && res.toLowerCase().endsWith('.pdf')) {
        setOutputPath(res)
        setStatus(`已生成：${res}`)
        toast.success('PDF已生成')
      } else {
        toast.error('生成失败')
        setStatus('生成失败')
      }
    } catch (err: any) {
      toast.error(String(err?.message || err || '生成失败'))
      setStatus('生成失败')
    } finally {
      setLoading(false)
    }
  }, [url])

  const onSaveAs = useCallback(async (): Promise<void> => {
    if (!outputPath) return
    const filters = [{ name: 'PDF', extensions: ['pdf'] }]
    const res = await window.api.saveAs(outputPath, { defaultPath: outputPath, filters })
    if (res.saved) {
      toast.success(`已保存到：${res.destPath}`)
    }
  }, [outputPath])

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <FileDown className="size-6 text-amber-600 dark:text-amber-400" />
          PDF生成
        </h2>
        <GoHome />
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">PDF生成</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">输入网页URL</label>
            <Input
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-label="网页URL"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={onGenerate} disabled={loading}>
              生成PDF
            </Button>
            <Button onClick={onSaveAs} variant="secondary" disabled={!outputPath}>
              <Download className="size-4" />
              另存为
            </Button>
          </div>
          {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}

export default Pdf
