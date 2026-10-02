.PHONY: all core test-core clean

all: core

core:
	$(MAKE) -C core all

test-core:
	$(MAKE) -C core test

clean:
	$(MAKE) -C core clean
