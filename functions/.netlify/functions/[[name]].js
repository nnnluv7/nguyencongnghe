// Catch-all Pages Function for /.netlify/functions/<name>.
// Keeps the exact Netlify URL shape so the frontend, _redirects rewrites and
// stored avatar/story/webhook URLs need no changes. Dispatches to the real
// lib handlers in ../_cf/handlers.mjs.
import {handleFunctionRequest} from '../../_cf/handlers.mjs';

export async function onRequest(context) {
  const segments = context.params.name || [];
  return handleFunctionRequest(context, segments);
}
