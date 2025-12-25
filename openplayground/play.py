

import functools
import pandas as pd
user = {"role":"admin"}

def make_secure(func):
    @functools.wraps(func)
    def wrapper():
        if user.get('role') == 'admin':
            func()
        else:
            print('func will not rn')
    return wrapper
    


@make_secure
def do_stuff():
    print("in do stuff")
    


# do_stuff()

print("name of do stuff is:{}".format(do_stuff.__name__))
tempdict = {'col1':[1,2,3], 'col2':['boo','foo','None']}
df = pd.DataFrame.from_dict(tempdict)

print(df.head())

