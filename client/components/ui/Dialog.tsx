'use client';
import React, { useEffect, useRef } from 'react';

export function Dialog({ open, onClose, title, children, footer }: { open: boolean, onClose: () => void, title: string, children: React.ReactNode, footer?: React.ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [open]);

  return (
    <dialog ref={dialogRef} className="dialog-box" onCancel={onClose} onClick={(e) => { if(e.target === dialogRef.current) onClose(); }}>
      <div onClick={(e) => e.stopPropagation()}>
        <h3 className="dialog-title">{title}</h3>
        <div>{children}</div>
        {footer && <div className="dialog-footer">{footer}</div>}
      </div>
    </dialog>
  );
}
