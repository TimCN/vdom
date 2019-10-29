// 虚拟dom是什么
// 虚拟dom如何新建
// 虚拟dom如何渲染
// 虚拟dom如何更新

const VNODE_TYPE = {
  HTML: "HTML",
  TEXT: "TEXT",

}

const CHILD_TYPE = {
  EMPTY: "EMPTY",
  SINGLE: "SINGLE",
  MULTIPLE: "MULTIPLE",
}


function createTextVnode(child) {
  return {
    childType: CHILD_TYPE.EMPTY,
    comType: VNODE_TYPE.TEXT,
    type: null,
    key: null,
    data: null,
    children: child
  }
}


function chkAndResetChildren(children) {

  if (Array.isArray(children)) {
    children = children.map(child => chkAndResetChild(child))
  } else {
    children = chkAndResetChild(children)
  }

  return children;

}

function chkAndResetChild(child) {
  if (!child) {
    return child;
  }
  // 文本节点处理
  if (!child.comType || (child.comType && child.comType !== VNODE_TYPE.HTML)) {
    // 文本节点，对children进去包装
    child = createTextVnode(child + "")
  }
  return child
}


function createElement(type, data, children = null) {
  let comType;
  if (typeof type === "string") {
    // 普通的html标签
    comType = VNODE_TYPE.HTML
  } else {
    comType = VNODE_TYPE.TEXT
  }
  let childType = CHILD_TYPE.EMPTY;
  // 不太严谨
  if (Array.isArray(children) && children.length > 1) {
    childType = CHILD_TYPE.MULTIPLE
  } else if (children) {
    childType = CHILD_TYPE.SINGLE
    if (Array.isArray(children)) {
      children = children[0]
    }

  }
  // TODO: 确认react的处理方式
  children = chkAndResetChildren(children)

  // 返回
  return {
    childType,
    comType,
    type,
    key: data.key,
    data,
    children
  }
}


function render(vnode, container) {
  if (container.vnode) {
    // update
    patch(container.vnode, vnode, container)
  } else {
    // mount
    mount(vnode, container);
  }
  container.vnode = vnode
}


function patch(prevVnode, nextVnode, container) {


  // 1. 组件类型不同，直接卸载之前的组件，安装新的组件
  const prevType = prevVnode.type;
  const nextType = nextVnode.type;
  if (prevType !== nextType) {
    // 
    replaceVnode(prevVnode, nextVnode, container)
  } else if (nextVnode.comType === VNODE_TYPE.HTML) {
    patchElement(prevVnode, nextVnode, container)
  } else if (nextVnode.comType === VNODE_TYPE.TEXT) {
    patchText(prevVnode, nextVnode, container);
  }
}

function patchElement(prevVnode, nextVnode, container) {
  const el = nextVnode.el = prevVnode.el
  const prevData = prevVnode.data
  const nextData = nextVnode.data

  // PATCH DATA
  // 更换data
  for (let key in nextData) {
    patchData(el, key, prevData[key], nextData[key]);
  }
  // 删除多余的data
  Object.keys(prevData).forEach(key => {
    if (!nextData.hasOwnProperty(key)) {
      patchData(el, key, prevData[key], undefined);
    }
  })

  // PATCH DATA END

  // PATCH CHILDREN 
  patchChildren(
    prevVnode.childType,
    nextVnode.childType,
    prevVnode.children,
    nextVnode.children,
    el
  )

  // PATCH CHILDREN END

}

function patchChildren(prevType, nextType, prev, next, container) {
  if (nextType === CHILD_TYPE.EMPTY) {
    // 清空之前的子节点
    if (prevType !== CHILD_TYPE.EMPTY) {
      container.removeChild(prev);
    }

  } else if (nextType === CHILD_TYPE.SINGLE) {
    // 单节点
    switch (prevType) {
      case CHILD_TYPE.EMPTY:
        mount(next, container)
        break;
      case CHILD_TYPE.SINGLE:
        patch(prev, next, container)
        break;
      case CHILD_TYPE.MULTIPLE:
        prev.forEach(p => container.removeChild(p))
        mount(next, container)
        break;
    }

  } else if (nextType === CHILD_TYPE.MULTIPLE) {
    // 多节点
    switch (prevType) {
      case CHILD_TYPE.EMPTY:
        mount(next, container)
        break;
      case CHILD_TYPE.SINGLE:
        container.removeChild(prev);
        next.forEach(p => mount(p, container))
        break;
      case CHILD_TYPE.MULTIPLE:
        // 多对多更新： abc => abc  abc => bac   
        // TODO: 需要优化
        // 删除多余节点
        for (let i = 0; i < prev.length; i++) {
          const prevVnode = prev[i]
          const has = next.find(n => n.key === prevVnode.key);
          if (!has) {
            container.removeChild(prevVnode.el)
          }
        }

        let lastIndex = 0;
        for (let i = 0; i < next.length; i++) {
          let nextVnode = next[i];
          let find = false;
          let j = 0;
          for (; j < prev.length; j++) {
            let prevVnode = prev[j];
            if (prevVnode.key === nextVnode.key) {
              find = true;
              patch(prevVnode, nextVnode, container);
              if (j < lastIndex) {
                const beforeNode = next[i - 1].el.nextSibling;
                container.insertBefore(prevVnode.el, beforeNode)
              } else {
                lastIndex = j;
              }
              break;
            }
          }

          // 需要新增
          if (!find) {
            const beforeNode = i === 0 ? prev[0].el : next[i - 1].el.nextSibling;
            mount(nextVnode, container, beforeNode)
          }




        }



        break;
    }
  }
}

function patchText(prevVnode, nextVnode) {
  let el = nextVnode.el = prevVnode.el;
  if (nextVnode.children !== prevVnode.children) {
    el.nodeValue = nextVnode
  }

}

function replaceVnode(prevVnode, nextVnode, container) {
  container.removeChild(prevVnode.el);
  mount(nextVnode, container)
}

function mountText(vnode, container) {
  const el = document.createTextNode(vnode.children)
  vnode.el = el
  container.appendChild(el)
}

function patchData(el, key, prev, next) {
  switch (key) {
    case "style":
      for (let k in next) {
        el.style[k] = next[k]
      }
      for (let k in prev) {
        if (!next.hasOwnProperty(k)) {
          el.style[k] = ""
        }
      }
      break;
    case "class":
      el.className = next;
    default:
      if (key[0] === "@") {
        if (prev) {
          el.removeEventListener(key.slice(1), prev)
        }
        if (next) {
          el.addEventListener(key.slice(1), next);
        }
      } else if (next) {
        el.setAttribute(key, next)
      } else {
        el.removeAttribute(key);
      }
  }
}
function mountElement(vnode, container, beforeNode) {
  const { data } = vnode
  let el = document.createElement(vnode.type);
  vnode.el = el;
  if (vnode.childType === CHILD_TYPE.MULTIPLE) {
    vnode.children.forEach(child => {
      mount(child, el)
    });
  } else if (vnode.childType === CHILD_TYPE.SINGLE) {
    mount(vnode.children, el)
  }
  // patchData(vnode)
  if (data) {
    for (let key in data) {
      patchData(el, key, null, data[key])
    }
  }

  if (beforeNode) {
    container.insertBefore(el, beforeNode)
  } else {
    container.appendChild(el)
  }


}

function mount(vnode, container, beforeNode) {
  if (vnode.comType === VNODE_TYPE.HTML) {
    mountElement(vnode, container, beforeNode);
  } else {
    mountText(vnode, container);
  }

}