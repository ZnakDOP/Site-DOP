import { AlertCircle } from "lucide-react"
import { useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function App() {
  const [showLoadError] = useState(true)

  return (
    <div className="min-h-svh bg-muted/30">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-col gap-2">
          <a
            className="text-muted-foreground text-sm hover:text-foreground"
            href="../index.html"
          >
            ← На главную (статический сайт)
          </a>
          <h1 className="text-2xl font-semibold tracking-tight">
            Бронирование техники
          </h1>
          <p className="text-muted-foreground text-sm">
            Прототип экрана на React + shadcn/ui — те же блоки, что в{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">booking.html</code>
            : каталог, корзина, алерт ошибки, поля заявки.
          </p>
        </header>

        {showLoadError ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Не удалось загрузить каталог</AlertTitle>
            <AlertDescription>
              Пример состояния из <code>#load-error</code> в боевой вёрстке. В
              shadcn это готовый <code>Alert</code> с ролью{" "}
              <code>alert</code> и вариантом <code>destructive</code>.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-6 md:grid-cols-[1fr_340px]">
          <Card>
            <CardHeader>
              <CardTitle>Каталог</CardTitle>
              <CardDescription>
                Цены за одну смену. Итог умножается на число смен.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">Sony FX6 kit</p>
                    <p className="text-muted-foreground text-sm">
                      Камера, объектив, карты — пример позиции
                    </p>
                  </div>
                  <Button size="sm" variant="secondary">
                    В корзину
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Корзина</CardTitle>
              <CardDescription>
                Период аренды и контакты — композиция Input + Label + Button.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="demo-name">Имя</Label>
                <Input
                  id="demo-name"
                  autoComplete="name"
                  placeholder="Как к вам обращаться"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="demo-phone">Телефон или Telegram</Label>
                <Input
                  id="demo-phone"
                  autoComplete="tel"
                  placeholder="+7 … или @username"
                />
              </div>
              <div className="flex items-center justify-between border-t pt-4 text-sm">
                <span className="text-muted-foreground">Итого</span>
                <span className="text-lg font-semibold">0 ₽</span>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full">Отправить заявку</Button>
            </CardFooter>
          </Card>
        </div>

        <p className="text-muted-foreground text-center text-xs">
          Добавляйте компоненты через CLI в этой папке:{" "}
          <code className="rounded bg-muted px-1 py-0.5">
            npx shadcn@latest add dialog calendar
          </code>
          — Cursor подхватит <code>components.json</code>.
        </p>
      </div>
    </div>
  )
}
