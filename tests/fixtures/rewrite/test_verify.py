"""Negative controls for the semantic report comparator; no GPU or dependencies."""
import unittest
from verify import compare, pointer, fixture_hash


class ComparisonTests(unittest.TestCase):
    def test_git_line_endings_do_not_change_fixture_identity(self):
        self.assertEqual(fixture_hash(b"{}\r\n"), fixture_hash(b"{}\n"))
        self.assertNotEqual(fixture_hash(b"{}\n"), fixture_hash(b"[]\n"))

    def test_numeric_tolerance_and_exact_types(self):
        compare({"a": 0.12000000001, "valid": True},
                {"near": {"/a": [0.12, 1e-9]}, "exact": {"/valid": True}})
        for actual in [12.0, float("nan"), float("inf"), True, "0.12"]:
            with self.assertRaises(ValueError):
                compare({"a": actual}, {"near": {"/a": [0.12, 1e-9]}})
        with self.assertRaises(ValueError):
            compare({"valid": 1}, {"exact": {"/valid": True}})

    def test_missing_fields_and_wrong_diagnostics_fail(self):
        with self.assertRaises(KeyError):
            compare({}, {"exact": {"/valid": False}})
        with self.assertRaises(ValueError):
            compare({"code": "other"}, {"exact": {"/code": "invalid_reference"}})

    def test_pointer_escapes_and_array_index(self):
        self.assertEqual(pointer({"a/b": [{"~key": 3}]}, "/a~1b/0/~0key"), 3)


if __name__ == "__main__":
    unittest.main()
