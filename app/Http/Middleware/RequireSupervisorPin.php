<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireSupervisorPin
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->canBypassPin()) {
            return $next($request);
        }

        if ($request->session()->get('supervisor_pin_verified_until') && now()->lt($request->session()->get('supervisor_pin_verified_until'))) {
            return $next($request);
        }

        return redirect()->route('supervisor.pin.form')->with('status', 'Se requiere PIN de supervisor');
    }
}
