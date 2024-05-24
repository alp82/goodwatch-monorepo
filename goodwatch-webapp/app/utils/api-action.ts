import { useState } from 'react'
import { useRevalidator } from '@remix-run/react'

interface UseSubmitProps<Params> {
  url: `/api/${string}`
  params: Params
}

export const useAPIAction = <Params extends {}, Result extends {}>({ url, params }: UseSubmitProps<Params>) => {
  let revalidator = useRevalidator();

  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  const handleSubmit = async () => {
    setSubmitting(true)
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify(params)
    })
    const result: Result = await response.json()
    setResult(result)
    setSubmitting(false)
    revalidator.revalidate()
  }

  const submitProps = {
    onClick: handleSubmit,
    disabled: submitting || null,
    style: submitting ? { pointerEvents: "none", opacity: 0.5 } : {},
  }

  return {
    result,
    submitting,
    submitProps,
  };
};
