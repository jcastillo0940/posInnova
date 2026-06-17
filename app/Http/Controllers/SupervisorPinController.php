<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;

class SupervisorPinController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('Supervisor/Pin');
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'pin' => ['required', 'string', 'min:4', 'max:12'],
        ]);

        $user = $request->user();

        if (! $user?->pin_hash || ! Hash::check($data['pin'], $user->pin_hash)) {
            return back()->withErrors(['pin' => 'PIN invalido']);
        }

        $request->session()->put('supervisor_pin_verified_until', now()->addMinutes(30));

        return redirect()->intended(route('dashboard'))->with('status', 'PIN verificado');
    }
}
