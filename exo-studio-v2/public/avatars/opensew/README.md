# Bundled fitting avatars

`default_character.blend` (Nora, the female figure) and `default_man.blend`
(Theo, the male figure) are dedicated to the **public domain (CC0 1.0)**.

Both bodies were generated with [MPFB2](https://static.makehumancommunity.org/mpfb.html),
the MakeHuman plugin for Blender, from the MakeHuman community's base mesh,
targets, skeleton and weight data — all of which the MakeHuman project
publishes under CC0, with the characters produced from them CC0 as well
([license](https://static.makehumancommunity.org/about/license.html),
[FAQ](https://static.makehumancommunity.org/mpfb/faq/is_it_really_free.html)).
No Reallusion, Adobe/Mixamo, Epic or other third-party character data is
contained in these files; the rig merely *names* its bones in the Mixamo
convention so downstream tools recognise them.

They are rebuilt from scratch, deterministically, with:

    blender -b --python tools/make_default_avatars.py

(requires the MPFB extension installed in Blender).
