import { useCallback, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Download,
  FileDown,
  Globe,
  Loader2,
  FileText,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import GoHome from '@/components/common/goHome'
import { motion } from 'motion/react'
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
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="w-full h-full space-y-6 mx-auto max-w-5xl"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileDown className="size-6 text-primary" />
            网页转 PDF
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            输入网页地址，将其完整转换为高品质 PDF 文档
          </p>
        </div>
        <GoHome />
      </div>

      <Card className="max-w-5xl shadow-sm">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="size-4" />
            转换设置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="space-y-2">
            <Label htmlFor="url-input">网页地址 (URL)</Label>
            <div className="relative group">
              <Globe className="absolute left-3 top-2.5 size-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <Input
                id="url-input"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="pl-9 font-mono text-sm"
                autoComplete="url"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              支持 HTTP/HTTPS 协议，建议输入完整 URL
            </p>
          </div>

          {status && (
            <div
              className={cn(
                'rounded-md border p-3 flex items-start gap-3 text-sm',
                status.includes('失败')
                  ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-900 dark:text-red-300'
                  : status.includes('已生成')
                    ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-900 dark:text-green-300'
                    : 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-900 dark:text-blue-300'
              )}
            >
              {status.includes('失败') ? (
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
              ) : status.includes('已生成') ? (
                <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
              ) : (
                <Loader2 className="size-4 shrink-0 mt-0.5 animate-spin" />
              )}
              <div className="space-y-0.5 flex-1">
                <p className="font-medium">
                  {status.includes('失败')
                    ? '转换失败'
                    : status.includes('已生成')
                      ? '转换成功'
                      : '处理中'}
                </p>
                <p className="opacity-90 break-all">{status}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={onGenerate} disabled={loading || !url.trim()} className="w-32">
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  转换中
                </>
              ) : (
                <>
                  <FileDown className="mr-2 size-4" />
                  生成 PDF
                </>
              )}
            </Button>

            {outputPath && (
              <Button onClick={onSaveAs} variant="outline" className="gap-2">
                <Download className="size-4" />
                另存为...
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default Pdf
