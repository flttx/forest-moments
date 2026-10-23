"""Opt-in, child-process-only workaround for a stalled Windows WMI service."""
import os
import platform

if os.environ.get('FOREST_BLENDER_WMI_FALLBACK') == '1' and os.name == 'nt':
    # Python 3.13 then uses its existing Win32/registry fallback, not invented values.
    # This deliberately does not modify Blender's installation or Windows services.
    if hasattr(platform, '_wmi'):
        platform._wmi = None
        print('FOREST_WMI_FALLBACK_ACTIVE', flush=True)
