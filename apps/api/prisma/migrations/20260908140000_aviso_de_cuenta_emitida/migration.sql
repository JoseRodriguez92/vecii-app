-- El aviso de que ya esta la cuenta del mes. Se manda al EMITIR, no al generar:
-- el borrador no existe para el residente.
ALTER TYPE "TipoNotificacion" ADD VALUE 'CUENTA_EMITIDA';
