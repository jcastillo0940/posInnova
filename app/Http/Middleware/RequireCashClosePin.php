<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireCashClosePin
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()?->canCloseCash()) {
            abort(403);
        }

        if ($request->session()->get('supervisor_pin_verified_until') && now()->lt($request->session()->get('supervisor_pin_verified_until'))) {
            return $next($request);
        }

        return redirect()->guest(route('supervisor.pin.form'))->with('status', 'Se requiere PIN para cerrar caja');
    }
}
