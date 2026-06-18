<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function index(): Response
    {
        abort_unless(auth()->user()?->isSuperAdmin(), 403);

        return Inertia::render('Admin/Users/Index', [
            'users' => User::query()
                ->orderBy('name')
                ->get()
                ->map(fn (User $user) => $this->userPayload($user)),
            'roles' => $this->roles(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'role' => ['required', Rule::in($this->roles())],
        ]);

        User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'role' => $data['role'],
            'is_active' => true,
            'password' => Hash::make('1234'),
            'pin_hash' => Hash::make('1234'),
        ]);

        return back()->with('success', 'Usuario creado correctamente.');
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'role' => ['required', Rule::in($this->roles())],
        ]);

        $user->update($data);

        return back()->with('success', 'Usuario actualizado correctamente.');
    }

    public function toggle(Request $request, User $user): RedirectResponse
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);
        abort_if($request->user()?->is($user), 422, 'No puedes eliminar tu propio usuario.');

        $user->update([
            'is_active' => ! $user->is_active,
        ]);

        return back()->with('success', $user->is_active ? 'Usuario activado correctamente.' : 'Usuario desactivado correctamente.');
    }

    public function resetPassword(Request $request, User $user): RedirectResponse
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);

        $user->update([
            'password' => Hash::make('1234'),
        ]);

        return back()->with('success', 'Contraseña restablecida a 1234.');
    }

    public function resetPin(Request $request, User $user): RedirectResponse
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);

        $user->update([
            'pin_hash' => Hash::make('1234'),
        ]);

        return back()->with('success', 'PIN restablecido a 1234.');
    }

    private function roles(): array
    {
        return ['owner', 'super', 'admin', 'supervisor', 'cashier', 'seller', 'warehouse', 'accountant'];
    }

    private function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'is_active' => (bool) $user->is_active,
            'created_at' => $user->created_at?->format('d/m/Y h:i a'),
            'updated_at' => $user->updated_at?->format('d/m/Y h:i a'),
        ];
    }
}
