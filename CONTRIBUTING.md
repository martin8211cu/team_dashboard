# Contribuir a Team Dashboard

Gracias por interesar en este proyecto. El repositorio es **público** bajo [MIT](LICENSE); las contribuciones son bienvenidas siempre que respeten la privacidad del equipo y no expongan secretos.

## Código de conducta

Participa con respeto: feedback constructivo, sin acoso ni discriminación. Los maintainers pueden cerrar issues o PRs que no cumplan estas expectativas.

## Qué no subir nunca

- Archivos `.env`, tokens de Jira, `DATABASE_URL` con credenciales reales, API keys o exports con datos sensibles del cliente.
- `packages/shared/config/teams/local.json` u otros JSON locales con datos de tu organización (usa `TEAM_*` en `.env` o `example.json` como referencia).
- Contraseñas, dumps de base de datos o capturas con PII.

Si accidentalmente commiteas un secreto, **rota el token/credencial de inmediato** y abre un issue para que podamos ayudarte a limpiar el historial si hace falta.

## Antes de empezar

1. Lee el [README](README.md) (stack, variables de entorno, scripts).
2. Copia `.env.example` → `.env` y configura un Postgres y credenciales **de prueba** (Jira opcional según el cambio que hagas).
3. Ejecuta `bun install` y `bun run db:setup` para tener esquema y seeds locales.

Requisito de runtime: [Bun 1.2+](https://bun.sh).

## Reportar bugs y proponer mejoras

Usa [GitHub Issues](https://github.com/martin8211cu/team_dashboard/issues) en este repositorio:

- **Bug:** pasos para reproducir, comportamiento esperado vs actual, OS/navegador si aplica, logs sin secretos.
- **Feature:** problema que resuelve, alternativas consideradas, alcance acotado si es posible.

No abras issues públicos con credenciales ni datos reales de Jira/equipo.

## Flujo de contribución (pull requests)

1. **Fork** del repo y clona tu fork.
2. Crea una rama desde `main`, por ejemplo `fix/auth-session`, `feat/members-export` o `docs/docker-coolify`.
3. Haz cambios acotados (un tema por PR facilita la revisión).
4. Verifica localmente:

   ```bash
   bun run typecheck
   ```

   Si tocas el frontend o la API, prueba el flujo relevante (`bun run dev` o `dev:api` + `dev:web`).

5. **Commit:** mensajes claros en imperativo o convención del historial del repo (p. ej. `fix(api): …`, `feat(web): …`, `docs: …`).
6. Abre un **Pull Request** hacia `main` con:
   - Resumen del cambio y motivación.
   - Cómo lo probaste.
   - Issues relacionados (`Fixes #123` si aplica).

Los maintainers revisarán el PR; pueden pedir ajustes antes del merge.

## Estructura del monorepo

| Ruta | Uso |
| --- | --- |
| `apps/api` | API Hono, auth, Jira, worker |
| `apps/web` | UI React + TanStack Router |
| `apps/cli` | Exports Excel |
| `packages/shared` | Jira, métricas, config de equipo |
| `packages/db` | Knex, migraciones, seeds |

Coloca la lógica compartida en `packages/shared`; evita duplicar entre api/web/cli.

## Estándares de código

- **TypeScript** en apps y packages; mantén tipos explícitos donde el resto del archivo lo hace.
- Sigue el estilo del archivo que editas (nombres, imports, patrones existentes).
- No añadas dependencias pesadas sin justificación en el PR.
- Migraciones de base de datos: solo en `packages/db`; incluye `up`/`down` coherentes y documenta en el PR si requiere pasos manuales.

No hay linter unificado en el root; **`bun run typecheck`** es la comprobación mínima antes del PR.

## Seguridad

Si encuentras una vulnerabilidad, **no** la detalles en un issue público. Contacta a los maintainers por un canal privado acordado (p. ej. email del maintainer en el perfil de GitHub) con pasos de reproducción y impacto.

## Licencia

Al contribuir código, aceptas que tu aportación se publique bajo la misma [licencia MIT](LICENSE) del proyecto.
