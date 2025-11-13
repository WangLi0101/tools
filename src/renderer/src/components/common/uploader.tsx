import { useCallback, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface Props {
  onSelect: (file: File) => void
  className?: string
}

const Uploader = ({ onSelect, className }: Props): React.JSX.Element => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [preview, setPreview] = useState<string>('')

  const open = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleFile = useCallback(
    (file?: File) => {
      if (!file) return
      setPreview(file.path)
      onSelect(file)
    },
    [onSelect]
  )

  const onChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      const f = e.target.files?.[0]
      handleFile(f)
    },
    [handleFile]
  )

  const onDrop = useCallback<React.DragEventHandler<HTMLDivElement>>(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      const f = e.dataTransfer.files?.[0]
      handleFile(f)
    },
    [handleFile]
  )

  const onDragOver = useCallback<React.DragEventHandler<HTMLDivElement>>((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }, [])

  const onDragLeave = useCallback<React.DragEventHandler<HTMLDivElement>>((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }, [])

  return (
    <div className={cn('space-y-3', className)}>
      <div
        onClick={open}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors',
          dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'
        )}
      >
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">拖拽图片到此处，或点击选择文件</p>
          <Button variant="outline" size="sm">
            选择文件
          </Button>
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onChange} />
      </div>
      {preview && (
        <div className="rounded-md border p-2">
          <img src={`file://${preview}`} alt="预览" className="w-full h-auto rounded-md" />
        </div>
      )}
    </div>
  )
}

export default Uploader
