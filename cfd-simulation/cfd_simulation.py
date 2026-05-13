"""
Interactive 2D Fluid Dynamics Simulation - Flow Around a Cylinder
Uses the Lattice Boltzmann Method (LBM) with D2Q9 lattice.

Requirements: numpy, matplotlib, scipy
"""

import numpy as np
from scipy.ndimage import gaussian_filter
import matplotlib.pyplot as plt
from matplotlib.widgets import Slider
from matplotlib.patches import Circle
import matplotlib.colors as mcolors

# =============================================================================
# Physical Parameters
# =============================================================================
L_x = 2.0          # Channel length (m)
L_y = 0.8          # Channel height (m)
cyl_x = 0.5        # Cylinder center x (m)
cyl_y = 0.4        # Cylinder center y (m)
cyl_d = 0.1        # Cylinder diameter (m)
u_inlet = 0.1      # Inlet velocity (m/s)
nu_phys = 5e-4     # Kinematic viscosity (m^2/s)

# =============================================================================
# Lattice Parameters
# =============================================================================
Nx = 400            # Grid cells in x
Ny = 160            # Grid cells in y
dx = L_x / Nx      # Grid spacing

# D2Q9 lattice velocities and weights
e = np.array([[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1],
              [1, 1], [-1, 1], [-1, -1], [1, -1]])
w = np.array([4/9, 1/9, 1/9, 1/9, 1/9, 1/36, 1/36, 1/36, 1/36])
# Opposite direction indices for bounce-back
opp = np.array([0, 3, 4, 1, 2, 7, 8, 5, 6])


def compute_lattice_params(u_inlet_val, cyl_d_val):
    """Convert physical parameters to lattice units."""
    u_lb = 0.04  # Lattice velocity (keep small for stability)
    # dt is determined by u_lb = u_inlet * dt / dx
    dt = u_lb * dx / u_inlet_val
    nu_lb = nu_phys * dt / (dx * dx)
    tau = 3.0 * nu_lb + 0.5
    Re = u_inlet_val * cyl_d_val / nu_phys
    return u_lb, dt, nu_lb, tau, Re


def create_cylinder_mask(cyl_d_val):
    """Create boolean mask for cylinder cells."""
    cyl_r = cyl_d_val / 2.0
    # Grid coordinates in physical space
    x = np.linspace(0, L_x, Nx)
    y = np.linspace(0, L_y, Ny)
    X, Y = np.meshgrid(x, y)
    mask = (X - cyl_x)**2 + (Y - cyl_y)**2 <= cyl_r**2
    return mask


def equilibrium(rho, ux, uy):
    """Compute equilibrium distribution function."""
    feq = np.zeros((9, Ny, Nx))
    u_sq = ux**2 + uy**2
    for i in range(9):
        eu = e[i, 0] * ux + e[i, 1] * uy
        feq[i] = w[i] * rho * (1.0 + 3.0 * eu + 4.5 * eu**2 - 1.5 * u_sq)
    return feq


def initialize(u_lb):
    """Initialize the distribution functions with uniform flow."""
    rho = np.ones((Ny, Nx))
    ux = np.full((Ny, Nx), u_lb)
    uy = np.zeros((Ny, Nx))
    f = equilibrium(rho, ux, uy)
    return f, rho, ux, uy


def step(f, obstacle, tau, u_lb):
    """Perform one LBM time step."""
    # Collision (BGK)
    rho = np.sum(f, axis=0)
    ux = np.sum(f * e[:, 0].reshape(9, 1, 1), axis=0) / rho
    uy = np.sum(f * e[:, 1].reshape(9, 1, 1), axis=0) / rho

    feq = equilibrium(rho, ux, uy)
    f_out = f - (f - feq) / tau

    # Streaming
    f_new = np.zeros_like(f_out)
    for i in range(9):
        f_new[i] = np.roll(np.roll(f_out[i], e[i, 0], axis=1), e[i, 1], axis=0)

    # Bounce-back on obstacle
    for i in range(9):
        f_new[i][obstacle] = f_out[opp[i]][obstacle]

    # Inlet boundary (Zou-He style: fixed velocity)
    rho_in = (1.0 / (1.0 - u_lb)) * (
        f_new[0, :, 0] + f_new[2, :, 0] + f_new[4, :, 0] +
        2.0 * (f_new[3, :, 0] + f_new[6, :, 0] + f_new[7, :, 0])
    )
    f_new[1, :, 0] = f_new[3, :, 0] + (2.0/3.0) * rho_in * u_lb
    f_new[5, :, 0] = f_new[7, :, 0] + (1.0/6.0) * rho_in * u_lb
    f_new[8, :, 0] = f_new[6, :, 0] + (1.0/6.0) * rho_in * u_lb

    # Outlet boundary (zero gradient)
    f_new[:, :, -1] = f_new[:, :, -2]

    # Top and bottom walls (bounce-back)
    for i in range(9):
        f_new[i, 0, :] = f_out[opp[i], 0, :]
        f_new[i, -1, :] = f_out[opp[i], -1, :]

    return f_new


def run_simulation(n_steps, f, obstacle, tau, u_lb):
    """Run simulation for n_steps."""
    for _ in range(n_steps):
        f = step(f, obstacle, tau, u_lb)
    # Compute macroscopic quantities
    rho = np.sum(f, axis=0)
    ux = np.sum(f * e[:, 0].reshape(9, 1, 1), axis=0) / rho
    uy = np.sum(f * e[:, 1].reshape(9, 1, 1), axis=0) / rho
    return f, rho, ux, uy


# =============================================================================
# Main Simulation and Visualization
# =============================================================================
def main():
    # Initial parameters
    current_u = u_inlet
    current_d = cyl_d

    u_lb, dt, nu_lb, tau, Re = compute_lattice_params(current_u, current_d)
    obstacle = create_cylinder_mask(current_d)

    print(f"Lattice Boltzmann CFD Simulation")
    print(f"  Grid: {Nx} x {Ny}")
    print(f"  Re = {Re:.1f}, tau = {tau:.4f}")
    print(f"  Running initial {1000} steps to develop flow...")

    f, rho, ux, uy = initialize(u_lb)
    f, rho, ux, uy = run_simulation(1000, f, obstacle, tau, u_lb)

    # Convert velocity to physical units
    vel_mag = np.sqrt(ux**2 + uy**2) * (current_u / u_lb)
    vel_mag_smooth = gaussian_filter(vel_mag, sigma=1.0)

    # Mask cylinder region
    vel_mag_smooth[obstacle] = np.nan

    # Physical coordinates for plotting
    x_phys = np.linspace(0, L_x, Nx)
    y_phys = np.linspace(0, L_y, Ny)
    X, Y = np.meshgrid(x_phys, y_phys)

    # =========================================================================
    # Visualization Setup
    # =========================================================================
    plt.style.use('dark_background')
    fig, ax = plt.subplots(1, 1, figsize=(14, 6))
    plt.subplots_adjust(bottom=0.22, top=0.88)

    # Velocity magnitude plot
    vmax = current_u * 2.0
    im = ax.pcolormesh(X, Y, vel_mag_smooth, cmap='inferno', shading='gouraud',
                       vmin=0, vmax=vmax)

    # Streamlines
    ux_phys = ux * (current_u / u_lb)
    uy_phys = uy * (current_u / u_lb)
    # Avoid zero velocity in obstacle
    ux_plot = ux_phys.copy()
    uy_plot = uy_phys.copy()
    ux_plot[obstacle] = 0
    uy_plot[obstacle] = 0

    stream = ax.streamplot(x_phys, y_phys, ux_plot, uy_plot,
                           color='white', linewidth=0.5, density=1.5,
                           arrowsize=0.5, arrowstyle='->')
    for artist in stream.lines.get_paths():
        pass
    stream.lines.set_alpha(0.4)

    # Cylinder glow effect
    glow = Circle((cyl_x, cyl_y), current_d/2 * 1.4, color='white',
                  alpha=0.15, zorder=5)
    glow2 = Circle((cyl_x, cyl_y), current_d/2 * 1.2, color='white',
                   alpha=0.25, zorder=6)
    cyl_patch = Circle((cyl_x, cyl_y), current_d/2, color='white',
                       alpha=1.0, zorder=7)
    ax.add_patch(glow)
    ax.add_patch(glow2)
    ax.add_patch(cyl_patch)

    # Reynolds number text box
    re_text = ax.text(0.02, 0.95, f'Re = {Re:.1f}', transform=ax.transAxes,
                      fontsize=12, color='white', fontweight='bold',
                      verticalalignment='top',
                      bbox=dict(boxstyle='round,pad=0.4', facecolor='black',
                                alpha=0.6, edgecolor='gray', linewidth=0.5))

    # Colorbar
    cbar = fig.colorbar(im, ax=ax, orientation='horizontal', pad=0.12,
                        fraction=0.03, aspect=40,
                        location='top')
    cbar.set_label('Velocity Magnitude (m/s)', color='white', fontsize=10)
    cbar.ax.tick_params(colors='white')

    ax.set_xlim(0, L_x)
    ax.set_ylim(0, L_y)
    ax.set_aspect('equal')
    ax.set_xlabel('x (m)', color='white')
    ax.set_ylabel('y (m)', color='white')
    ax.set_title('2D Lattice Boltzmann CFD — Flow Around a Cylinder',
                 color='white', fontsize=13, fontweight='bold', pad=35)

    # =========================================================================
    # Sliders
    # =========================================================================
    ax_speed = plt.axes([0.2, 0.06, 0.6, 0.03])
    ax_diam = plt.axes([0.2, 0.02, 0.6, 0.03])

    slider_speed = Slider(ax_speed, 'Inlet Speed (m/s)', 0.01, 0.5,
                          valinit=current_u, valstep=0.01, color='orange')
    slider_diam = Slider(ax_diam, 'Cylinder Dia (m)', 0.02, 0.3,
                         valinit=current_d, valstep=0.01, color='orange')

    def update(val):
        nonlocal f, obstacle, tau, u_lb, current_u, current_d

        new_u = slider_speed.val
        new_d = slider_diam.val

        params_changed = (new_u != current_u) or (new_d != current_d)
        if not params_changed:
            return

        current_u = new_u
        current_d = new_d

        u_lb_new, dt_new, nu_lb_new, tau_new, Re_new = compute_lattice_params(current_u, current_d)
        obstacle_new = create_cylinder_mask(current_d)

        u_lb = u_lb_new
        tau = tau_new
        obstacle = obstacle_new

        # Re-initialize and run
        f_new, _, _, _ = initialize(u_lb)
        f_new, rho_new, ux_new, uy_new = run_simulation(500, f_new, obstacle, tau, u_lb)
        f = f_new

        # Update plot
        vel_new = np.sqrt(ux_new**2 + uy_new**2) * (current_u / u_lb)
        vel_smooth = gaussian_filter(vel_new, sigma=1.0)
        vel_smooth[obstacle] = np.nan

        vmax_new = current_u * 2.0
        im.set_array(vel_smooth.ravel())
        im.set_clim(0, vmax_new)

        # Update cylinder patches
        cyl_patch.set_radius(current_d / 2)
        glow.set_radius(current_d / 2 * 1.4)
        glow2.set_radius(current_d / 2 * 1.2)

        # Update Re text
        re_text.set_text(f'Re = {Re_new:.1f}')

        fig.canvas.draw_idle()

    slider_speed.on_changed(update)
    slider_diam.on_changed(update)

    plt.show()


if __name__ == '__main__':
    main()
