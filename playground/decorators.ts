// This is a demonstration of how to use decorators in TypeScript.
// A Boat class is created with a decorator that logs the boat's color.
// The decorator is a function that takes a target and key as arguments.
// The decorator logs the color of the boat.
// The decorator is applied to the Boat class.


// Class
class Boat {
    color: string = 'red';
    get formattedColor(): string {
        return `This boat is ${this.color}`;
    }

    @logColor
    pilot(): void {
        console.log('swish');
        console.log('Inside pilot: this is', this);

    }

    @logError
    foo(): void {
        throw new Error('eeeee');
    }
}

// Decorator
function logColor(target: any, key: string, descriptor: PropertyDescriptor): void {
    console.log('log Target: ', target);
    console.log('log Key: ', key);
    console.log('log Descriptor: ', descriptor);
    console.log('Actual Target Prototype:', Object.getPrototypeOf(target));
    console.log('Class constructor:', Boat.prototype.constructor);
    console.log('Is target the prototype of the class?', target === Boat.prototype);
    console.log('Target Properties:', Object.getOwnPropertyNames(target));

}

function logError(target: any, key: string, descriptor: PropertyDescriptor): void {
    const method = descriptor.value;

    descriptor.value = function () {
        try {
            method();
        } catch (e) {
            console.log('Error thrown bla bla:', e);
        }
    }
}
// Create an instance of the Boat class
// const boat = new Boat();
// Access the formattedColor property
// console.log(boat.formattedColor);

const boat = new Boat();
boat.foo();