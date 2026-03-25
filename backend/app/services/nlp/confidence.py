#backend/app/services/nlp/confidence.py

def confidence_found(exact: bool = True):
    return 0.95 if exact else 0.75


def confidence_missing():
    return 0.0