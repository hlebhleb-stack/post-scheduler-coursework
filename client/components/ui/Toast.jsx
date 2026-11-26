import React from 'react';
import { Toaster as Sonner, toast } from 'sonner';

function Toaster(props) {
  return (
    <Sonner
      position="bottom-right"
      containerAriaLabel="Уведомления"
      toastOptions={{
        classNames: {
          toast: 'appToast',
          title: 'appToastTitle',
          description: 'appToastDescription',
        },
      }}
      {...props}
    />
  );
}

export { Toaster, toast };
