def between(main_text: str, value1: str, value2: str) -> str:
    return main_text.split(value1)[1].split(value2)[0]
