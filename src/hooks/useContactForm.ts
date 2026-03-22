import { useState } from 'react';
import type { FormEvent } from 'react';
import type { ContactFormData } from '../types';

const initialState: ContactFormData = {
  name: '',
  email: '',
  subject: '',
  message: '',
};

export function useContactForm() {
  const [formData, setFormData] = useState<ContactFormData>(initialState);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    setSubmitted(true);
  };

  const reset = () => {
    setFormData(initialState);
    setSubmitted(false);
  };

  return { formData, submitted, handleChange, handleSubmit, reset };
}
