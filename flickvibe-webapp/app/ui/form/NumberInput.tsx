import React, { ChangeEventHandler } from 'react'

export interface NumberInputProps {
  name: string
  placeholder: string
  defaultValue?: string
  onBlur?: ChangeEventHandler<HTMLInputElement>
  onChange?: ChangeEventHandler<HTMLInputElement>
}

export default function NumberInput({ name, placeholder, defaultValue, onBlur, onChange }: NumberInputProps) {
  return <div className="w-24">
    <label htmlFor={name} className="sr-only">
      {placeholder}
    </label>
    <input
      id={name}
      name={name}
      defaultValue={defaultValue}
      type="text"
      className="block w-full rounded-md border-0 py-1.5 bg-gray-700 text-gray-300 shadow-sm ring-inset ring-gray-300 placeholder-gray-400 focus:border-gray-400 focus:bg-slate-700 focus:text-gray-100 focus:ring-2 focus:ring-inset focus:ring-gray-400 sm:text-sm sm:leading-6"
      placeholder={placeholder}
      onBlur={onBlur}
      onChange={onChange}
    />
  </div>
}