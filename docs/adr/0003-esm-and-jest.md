# ADR 0003 — El backend es ESM; Jest corre en modo ESM

- Fecha: 2026-09-17
- Estado: aceptada

## Contexto

El stack oficial pide **Jest**, mientras la plantilla generada traía Vitest y
Oxlint. Al migrar a Jest se intentó primero pasar el proyecto a CommonJS, que es
el camino más probado con NestJS.

**Hallazgo:** `@nestjs/common@12` se publica **solo como ESM**. En CommonJS el
runtime falla con `Must use import to load ES Module`. CommonJS no es una opción.

## Decisión

1. El backend es **ESM** (`"type": "module"` + `module: nodenext`).
   Consecuencia permanente: los imports relativos llevan extensión `.js`.
2. **Jest** es el runner, ejecutado con `--experimental-vm-modules`
   (ver los scripts `test*` de `package.json`) y `ts-jest` con `useESM: true`.
3. En modo ESM Jest **no inyecta globals**: los specs que usan `jest.*` deben
   hacer `import { jest } from '@jest/globals'`.
4. **ESLint 10 + typescript-eslint** reemplazan Oxlint, y añaden las reglas de
   frontera entre capas.

## Alternativa descartada

**Vitest**, que soporta ESM sin configuración y es lo que trae la plantilla de
Nest 12. Se descartó porque el stack oficial define Jest y el modo ESM de Jest
quedó funcionando (18/18 tests en verde).

Si el flag experimental diera problemas en CI, Vitest es la salida natural: la
API de tests es casi idéntica.
